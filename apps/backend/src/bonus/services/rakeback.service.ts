import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import BigNumber from 'bignumber.js';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';

import { AssetTypeEnum, BalanceOperationEnum, RakebackEntity } from '@zetik/shared-entities';

import { BalanceService } from '../../balance/balance.service';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { UserVipStatusService } from './user-vip-status.service';
import { VipTierService } from './vip-tier.service';

export interface IRakebackAmountResponse {
  crypto: {
    [asset: string]: string; // Available rakeback amount in native asset
  };
}

export interface IClaimAllRakebackResponse {
  success: boolean;
  totalAssets: number;
  claimedCount: number;
  failedCount: number;
  claimedAssets: string[];
  failedAssets: Array<{
    asset: string;
    error: string;
  }>;
}

@Injectable()
export class RakebackService {
  private readonly logger = new Logger(RakebackService.name);

  constructor(
    @InjectRepository(RakebackEntity)
    private readonly rakebackRepository: Repository<RakebackEntity>,
    private readonly balanceService: BalanceService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly vipTierService: VipTierService,
    private readonly dataSource: DataSource,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  /**
   * Get available rakeback amounts by asset that can be claimed
   * Based on user's VIP tier rakeback percentage
   */
  async getRakebackAmount(userId: string): Promise<IRakebackAmountResponse> {
    // Find all rakeback records for user
    const rakebackRecords = await this.rakebackRepository.find({
      where: { userId },
    });

    // Get user's VIP status and tier
    const vipStatus = await this.userVipStatusService.getUserVipStatus(userId);
    let rakebackPercentage = 0;

    if (vipStatus && vipStatus.currentVipLevel > 0) {
      const vipTier = await this.vipTierService.findTierByLevel(vipStatus.currentVipLevel);
      if (vipTier?.rakebackPercentage) {
        rakebackPercentage = parseFloat(vipTier.rakebackPercentage) / 100; // Convert percentage to decimal
      }
    }

    if (rakebackPercentage <= 0) {
      return { crypto: {} };
    }

    const crypto: { [asset: string]: string } = {};

    for (const rakeback of rakebackRecords) {
      const accumulatedAmount = new BigNumber(rakeback.accumulatedHouseSideAmount);

      // Calculate actual rakeback amount: accumulated house side × user's rakeback percentage
      const rakebackAmount = accumulatedAmount
        .multipliedBy(rakebackPercentage)
        .decimalPlaces(8, BigNumber.ROUND_DOWN); // Round down in favor of casino

      // Only include assets with claimable amounts > 0
      if (rakebackAmount.isGreaterThan(0)) {
        crypto[rakeback.asset] = rakebackAmount.toFixed(8);
      }
    }

    return { crypto };
  }

  /**
   * Validate that asset is supported
   */
  private validateAsset(asset: string): boolean {
    return Object.values(AssetTypeEnum).includes(asset as AssetTypeEnum);
  }

  /**
   * Claim rakeback bonus for a user in specific asset based on VIP tier rakeback percentage
   * Creates a bonus transaction and credits the user's wallet
   *
   * Race Condition Protection:
   * - Uses distributed lock to prevent double-claiming across multiple instances
   * - Lock resource: bonus:rakeback:claim:${userId}:${asset}
   * - Lock TTL: 10000ms
   */
  async claimRakeback(
    userId: string,
    asset: AssetTypeEnum,
  ): Promise<{
    success: boolean;
    amount: string;
    asset: string;
    error?: string;
  }> {
    // Acquire distributed lock to prevent double-claiming
    const lockResource = LockKeyBuilder.bonusRakeback(userId, asset);

    try {
      return await this.distributedLockService.withLock(
        lockResource,
        LockTTL.STANDARD_OPERATION, // Bonus operation with DB updates
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Validate asset
            if (!this.validateAsset(asset)) {
              return {
                success: false,
                amount: '0.00000000',
                asset,
                error: `Unsupported asset: ${asset}`,
              };
            }

            // Find rakeback record for specific user and asset with lock
            const rakeback = await queryRunner.manager.findOne(RakebackEntity, {
              where: { userId, asset },
              lock: { mode: 'pessimistic_write' },
            });

            if (!rakeback) {
              return {
                success: false,
                amount: '0.00000000',
                asset,
                error: `No rakeback record found for asset ${asset}`,
              };
            }

            const accumulatedAmount = new BigNumber(rakeback.accumulatedHouseSideAmount);
            if (accumulatedAmount.isLessThanOrEqualTo(0)) {
              return {
                success: false,
                amount: '0.00000000',
                asset,
                error: 'No accumulated amount for rakeback calculation',
              };
            }

            // Get user's VIP status and tier
            const vipStatus = await this.userVipStatusService.getUserVipStatus(userId);
            let rakebackPercentage = 0;

            if (vipStatus && vipStatus.currentVipLevel > 0) {
              const vipTier = await this.vipTierService.findTierByLevel(vipStatus.currentVipLevel);
              if (vipTier?.rakebackPercentage) {
                rakebackPercentage = parseFloat(vipTier.rakebackPercentage) / 100; // Convert percentage to decimal
              }
            }

            if (rakebackPercentage <= 0) {
              return {
                success: false,
                amount: '0.00000000',
                asset,
                error: 'User has no rakeback percentage (VIP level too low)',
              };
            }

            // Calculate rakeback amount: accumulated house side × user's rakeback percentage
            const rakebackAmount = accumulatedAmount
              .multipliedBy(rakebackPercentage)
              .decimalPlaces(8, BigNumber.ROUND_DOWN); // Round down in favor of casino

            if (rakebackAmount.isLessThanOrEqualTo(0)) {
              return {
                success: false,
                amount: '0.00000000',
                asset,
                error: 'Calculated rakeback amount is zero',
              };
            }

            // Credit user's balance
            const operationId = randomUUID();
            const balanceResult = await this.balanceService.updateBalance(
              {
                operation: BalanceOperationEnum.BONUS,
                operationId,
                userId,
                amount: rakebackAmount,
                asset,
                description: `Rakeback claim (${rakebackAmount.toString()} ${asset} at ${(rakebackPercentage * 100).toFixed(1)}%)`,
                metadata: {
                  reason: 'RAKEBACK',
                  rakebackPercentage: (rakebackPercentage * 100).toFixed(1),
                  vipLevel: vipStatus?.currentVipLevel || 0,
                  accumulatedAmount: accumulatedAmount.toString(),
                },
              },
              queryRunner,
            );

            if (!balanceResult.success) {
              throw new Error(`Balance update failed: ${balanceResult.error}`);
            }

            // Reset accumulated house side to zero after successful claim
            rakeback.accumulatedHouseSideAmount = '0.00000000';
            await queryRunner.manager.save(rakeback);

            await queryRunner.commitTransaction();

            this.logger.log(`Rakeback claimed successfully`, {
              userId,
              amount: rakebackAmount.toString(),
              rakebackPercentage: (rakebackPercentage * 100).toFixed(1),
              vipLevel: vipStatus?.currentVipLevel || 0,
              asset,
            });

            return {
              success: true,
              amount: rakebackAmount.toString(),
              asset,
            };
          } catch (error: unknown) {
            await queryRunner.rollbackTransaction();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            this.logger.error(
              `Failed to claim VIP rakeback for user ${userId}: ${errorMessage}`,
              errorStack,
            );

            return {
              success: false,
              amount: '0.00000000',
              asset,
              error: errorMessage,
            };
          } finally {
            await queryRunner.release();
          }
        },
        {
          retryCount: 3,
          retryDelay: 200,
          retryJitter: 100,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for rakeback claim', {
          userId,
          asset,
          lockResource,
        });
        return {
          success: false,
          amount: '0.00000000',
          asset,
          error: 'The system is currently busy. Please try again in a moment.',
        };
      }
      throw error;
    }
  }

  /**
   * Claim all available rakeback bonuses for a user across all assets
   * Returns detailed results including which assets succeeded/failed
   *
   * Race Condition Protection:
   * - Uses distributed lock at user level to prevent concurrent claimAll operations
   * - Each individual asset claim also has its own lock (in claimRakeback)
   * - Lock resource: bonus:rakeback:claim-all:{userId}
   * - Lock TTL: 10000ms
   *
   * Partial Success Behavior:
   * - Claims are processed sequentially
   * - If claim #3 fails, claims #1-2 have already succeeded (atomic per asset)
   * - Returns detailed breakdown of successes and failures
   */
  async claimAllRakeback(userId: string): Promise<IClaimAllRakebackResponse> {
    const lockResource = LockKeyBuilder.bonusRakebackClaimAll(userId);

    try {
      return await this.distributedLockService.withLock(
        lockResource,
        LockTTL.STANDARD_OPERATION,
        async () => {
          const availableRakeback = await this.getRakebackAmount(userId);
          const assetsWithRakeback = Object.keys(availableRakeback.crypto);

          if (assetsWithRakeback.length === 0) {
            return {
              success: false,
              totalAssets: 0,
              claimedCount: 0,
              failedCount: 0,
              claimedAssets: [],
              failedAssets: [],
            };
          }

          let claimedCount = 0;
          const claimedAssets: string[] = [];
          const failedAssets: Array<{ asset: string; error: string }> = [];

          for (const asset of assetsWithRakeback) {
            try {
              const result = await this.claimRakeback(userId, asset as AssetTypeEnum);
              if (result.success) {
                claimedCount++;
                claimedAssets.push(asset);
              } else {
                failedAssets.push({
                  asset,
                  error: result.error || 'Unknown error',
                });
              }
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.logger.warn(`Failed to claim rakeback for ${asset}`, {
                userId,
                asset,
                error: errorMessage,
              });
              failedAssets.push({
                asset,
                error: errorMessage,
              });
            }
          }

          return {
            success: claimedCount > 0,
            totalAssets: assetsWithRakeback.length,
            claimedCount,
            failedCount: failedAssets.length,
            claimedAssets,
            failedAssets,
          };
        },
        {
          retryCount: 3,
          retryDelay: 200,
          retryJitter: 100,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for claim all rakeback', {
          userId,
          lockResource,
        });
        return {
          success: false,
          totalAssets: 0,
          claimedCount: 0,
          failedCount: 0,
          claimedAssets: [],
          failedAssets: [
            {
              asset: 'ALL',
              error: 'The system is currently busy. Please try again in a moment.',
            },
          ],
        };
      }
      throw error;
    }
  }
}
