import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  BalanceHistoryEntity,
  BalanceHistoryStatusEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  BalanceStatisticEntity,
  BalanceWalletEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource, QueryRunner } from 'typeorm';
import { UpdateBalanceDto } from '../../../backend/src/balance/dto/update-balance.dto';
import { LockTTL } from '../../../backend/src/common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../../backend/src/common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../../backend/src/common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../../backend/src/common/utils/lock-key-builder';

/**
 * Minimal Balance Service for Race Service
 *
 * This is a stripped-down implementation that provides only the balance update
 * methods needed for race prize distribution, without the heavy dependencies of
 * the full BalanceService (NotificationService, SelfExclusionService, etc.).
 *
 * IMPORTANT:
 * - Only used for BONUS operations (race prize distribution)
 * - No WebSocket notifications
 * - No self-exclusion checks
 * - No daily gambling stats tracking
 * - No user service calls
 * - No currency conversion (prizes already specify exact asset/amount)
 * - Uses distributed locking for race condition prevention
 * - Direct TypeORM repository operations
 *
 * Methods:
 * - updateBalance: Update balance (for race prizes)
 */
@Injectable()
export class RaceBalanceService {
  private readonly logger = new Logger(RaceBalanceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  /**
   * Format balance to remove trailing zeros
   */
  private formatBalance(balance: string): string {
    if (!balance || balance === '' || balance === null || balance === undefined) {
      return '0';
    }

    const balanceBN = new BigNumber(balance);

    if (balanceBN.isNaN()) {
      this.logger.error(`Balance is NaN: raw value was '${balance}'`);
      return '0';
    }

    return balanceBN.toString();
  }

  /**
   * Update user balance - simplified version for race prize distribution
   *
   * This implementation only supports BONUS operations for race prizes.
   * It uses distributed locking to prevent race conditions and performs
   * direct database operations without notifications, stats tracking, or currency conversion.
   *
   * IMPORTANT: Race prizes already specify the exact asset and amount - no conversion needed!
   */
  async updateBalance(dto: UpdateBalanceDto): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }> {
    // Validate that this is only used for BONUS operations (race prizes)
    if (dto.operation !== BalanceOperationEnum.BONUS) {
      this.logger.error(
        `RaceBalanceService.updateBalance called with non-BONUS operation: ${dto.operation}`,
      );
      return {
        success: false,
        status: BalanceOperationResultEnum.INVALID_OPERATION,
        balance: '0',
        error: 'RaceBalanceService only supports BONUS operations',
      };
    }

    // Lock resource key: balance:user:{userId}:{asset} for user-asset level locking
    const lockResource = LockKeyBuilder.balanceUser(dto.userId, dto.asset);
    const lockTTL = LockTTL.FAST_OPERATION; // Simple balance update

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for race prize distribution`, {
          userId: dto.userId,
          asset: dto.asset,
          operation: dto.operation,
          operationId: dto.operationId,
          lockResource,
        });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          // Check if operation already exists (idempotency)
          const existingOperation = await queryRunner.manager.findOne(BalanceHistoryEntity, {
            where: { operationId: dto.operationId },
          });

          if (existingOperation) {
            this.logger.log(
              `Operation ${dto.operationId} already exists, returning existing result`,
            );
            await queryRunner.rollbackTransaction();
            return {
              success: true,
              status: BalanceOperationResultEnum.OPERATION_EXISTS,
              balance: '0',
            };
          }

          // Update wallet and create history record
          const updatedWallet = await this.updateWalletAndHistoryAtomic(queryRunner, dto);

          // Update statistics (no conversion needed - use fixed value for race prizes)
          await this.updateStatisticsAtomic(queryRunner, dto);

          await queryRunner.commitTransaction();

          return {
            success: true,
            status: BalanceOperationResultEnum.SUCCESS,
            balance: this.formatBalance(updatedWallet.balance),
          };
        } catch (error: unknown) {
          await queryRunner.rollbackTransaction();

          this.logger.error(`Failed to update balance for race prize`, {
            operation: dto.operation,
            userId: dto.userId,
            amount: String(dto.amount),
            asset: dto.asset,
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            success: false,
            status: BalanceOperationResultEnum.FAILED,
            balance: '0',
            error: 'Failed to update balance',
          };
        } finally {
          await queryRunner.release();
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for balance operation', {
          userId: dto.userId,
          asset: dto.asset,
          operation: dto.operation,
          lockResource,
        });
        return {
          success: false,
          status: BalanceOperationResultEnum.FAILED,
          balance: '0',
          error: 'The system is currently busy. Please try again in a moment.',
        };
      }
      throw error;
    }
  }

  /**
   * Update wallet and create history record atomically
   * No currency conversion - race prizes already specify the exact asset and amount
   */
  private async updateWalletAndHistoryAtomic(
    queryRunner: QueryRunner,
    dto: UpdateBalanceDto,
  ): Promise<BalanceWalletEntity> {
    const walletRepo = queryRunner.manager.getRepository(BalanceWalletEntity);

    // BONUS operations always increase balance
    const balanceChange = new BigNumber(dto.amount.toString()).abs();

    // First try to update existing wallet
    const updateResult = await queryRunner.manager.query(
      `
      UPDATE balance.wallets
      SET balance = balance::numeric + $1::numeric,
          "updatedAt" = NOW()
      WHERE "userId" = $2 AND asset = $3
        AND (balance::numeric + $1::numeric) <= 999999999999
      RETURNING *, balance::text as balance_text
    `,
      [balanceChange.toString(), dto.userId, dto.asset],
    );

    let updatedWallet;

    // Check if any rows were actually updated
    if (updateResult[0].length === 0) {
      // Try to create wallet if it doesn't exist
      let wallet = await walletRepo.findOne({
        where: { userId: dto.userId, asset: dto.asset },
      });

      if (!wallet) {
        // Create new wallet with initial balance
        const existingCount = await walletRepo.count({ where: { userId: dto.userId } });

        wallet = walletRepo.create({
          userId: dto.userId,
          asset: dto.asset,
          balance: dto.amount.toString(),
          isPrimary: existingCount === 0,
        });

        wallet = await walletRepo.save(wallet);

        updatedWallet = {
          ...wallet,
          balance_text: wallet.balance,
        };
      } else {
        // Wallet exists but operation would exceed max balance
        throw new BadRequestException('Balance would exceed maximum allowed');
      }
    } else {
      // Wallet was successfully updated
      updatedWallet = updateResult[0][0];
    }

    if (!updatedWallet || !updatedWallet.balance_text) {
      this.logger.error(`Invalid wallet update result`, {
        operationId: dto.operationId,
        userId: dto.userId,
        asset: dto.asset,
      });
      throw new InternalServerErrorException('Failed to update wallet balance');
    }

    // Get previous balance for history
    const previousBalance = new BigNumber(updatedWallet.balance_text)
      .minus(balanceChange)
      .toString();

    // Store fixed rate of 1.0 for race prizes (no conversion needed)
    // Race prizes already specify the exact amount in the target asset
    const rate = '1.0';
    const amountCents = '0'; // Not used for race prizes

    // Create history record
    const history = new BalanceHistoryEntity();
    history.operationId = dto.operationId;
    history.operation = dto.operation;
    history.amount = dto.amount.toString();
    history.asset = dto.asset;
    history.userId = dto.userId;
    history.rate = rate;
    history.amountCents = amountCents;
    history.previousBalance = previousBalance;
    history.metadata = dto.metadata;
    history.description = dto.description;
    history.status = BalanceHistoryStatusEnum.CONFIRMED;
    await queryRunner.manager.save(history);

    // Return wallet entity format
    const walletEntity = new BalanceWalletEntity();
    Object.assign(walletEntity, updatedWallet);
    walletEntity.balance = updatedWallet.balance_text;

    return walletEntity;
  }

  /**
   * Update statistics atomically
   * For race prizes, we store the crypto amount directly (no conversion to cents)
   */
  private async updateStatisticsAtomic(
    queryRunner: QueryRunner,
    dto: UpdateBalanceDto,
  ): Promise<void> {
    // For race prizes, use the crypto amount directly (no conversion)
    // This keeps statistics simple and avoids unnecessary rate dependencies
    const amountCents = new BigNumber(dto.amount.toString()).multipliedBy(100).toFixed(0);

    // BONUS operations update deposits (bonuses are counted as deposits in stats)
    const updateQuery = `
      UPDATE balance.balance_statistics
      SET deps = deps::numeric + $2::numeric
      WHERE "userId" = $1
    `;
    const updateParams = [dto.userId, amountCents];

    const result = await queryRunner.manager.query(updateQuery, updateParams);

    // If no rows updated, create statistics record
    if (result[1] === 0) {
      const statistic = new BalanceStatisticEntity();
      statistic.userId = dto.userId;
      statistic.deps = amountCents;
      statistic.withs = '0';
      statistic.bets = '0';
      statistic.wins = '0';
      statistic.refunds = '0';

      await queryRunner.manager.save(statistic);
    }
  }
}
