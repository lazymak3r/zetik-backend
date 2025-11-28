import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource, In, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { BonusNotificationService } from './bonus-notification.service';

export interface IBonusFilters {
  status?: BonusTransactionStatusEnum[];
  bonusType?: BonusTypeEnum[];
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  limit: number;
}

export interface IBonusesWithFiltersResult {
  bonuses: BonusTransactionEntity[];
  total: number;
}

export interface ICancelBonusesResult {
  success: number;
  failed: string[];
}

@Injectable()
export class BonusTransactionService {
  private readonly logger = new Logger(BonusTransactionService.name);
  constructor(
    @InjectRepository(BonusTransactionEntity)
    private readonly txRepo: Repository<BonusTransactionEntity>,
    private readonly balanceService: BalanceService,
    private readonly cryptoConverter: CryptoConverterService,
    private readonly dataSource: DataSource,
    private readonly distributedLockService: DistributedLockService,
    private readonly bonusNotificationService: BonusNotificationService,
  ) {}

  async getPendingForUser(userId: string): Promise<BonusTransactionEntity[]> {
    return this.txRepo.find({ where: { userId, status: BonusTransactionStatusEnum.PENDING } });
  }

  /**
   * Fetch paginated bonus transactions for user, sorted by newest first.
   */
  async getTransactionsForUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
    bonusType?: string,
  ): Promise<BonusTransactionEntity[]> {
    const where: any = { userId, status: BonusTransactionStatusEnum.PENDING };

    if (bonusType) {
      where.bonusType = bonusType as BonusTypeEnum;
    }

    return this.txRepo.find({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /**
   * Count pending bonus transactions for user
   */
  async countPendingForUser(userId: string, bonusType?: string): Promise<number> {
    const where: any = { userId, status: BonusTransactionStatusEnum.PENDING };

    if (bonusType) {
      where.bonusType = bonusType as BonusTypeEnum;
    }

    return this.txRepo.count({ where });
  }

  /**
   * Fetch paginated bonus transactions for user with status filtering, sorted by newest first
   */
  async getTransactionsForUserWithFilters(
    userId: string,
    page: number = 1,
    limit: number = 10,
    statuses?: BonusTransactionStatusEnum[],
    bonusType?: string,
  ): Promise<BonusTransactionEntity[]> {
    const where: any = { userId };

    if (statuses && statuses.length > 0) {
      where.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (bonusType) {
      where.bonusType = bonusType as BonusTypeEnum;
    }

    const findOptions: any = {
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    // If multiple statuses, use IN query
    if (statuses && statuses.length > 1) {
      return this.txRepo
        .createQueryBuilder('bonus')
        .where('bonus.userId = :userId', { userId })
        .andWhere('bonus.status IN (:...statuses)', { statuses })
        .andWhere(
          bonusType ? 'bonus.bonusType = :bonusType' : '1=1',
          bonusType ? { bonusType } : {},
        )
        .orderBy('bonus.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();
    }

    return this.txRepo.find(findOptions);
  }

  /**
   * Count bonus transactions for user with status filtering
   */
  async countTransactionsForUserWithFilters(
    userId: string,
    statuses?: BonusTransactionStatusEnum[],
    bonusType?: string,
  ): Promise<number> {
    const where: any = { userId };

    if (statuses && statuses.length > 0) {
      where.status = statuses.length === 1 ? statuses[0] : statuses;
    }

    if (bonusType) {
      where.bonusType = bonusType as BonusTypeEnum;
    }

    // If multiple statuses, use query builder
    if (statuses && statuses.length > 1) {
      return this.txRepo
        .createQueryBuilder('bonus')
        .where('bonus.userId = :userId', { userId })
        .andWhere('bonus.status IN (:...statuses)', { statuses })
        .andWhere(
          bonusType ? 'bonus.bonusType = :bonusType' : '1=1',
          bonusType ? { bonusType } : {},
        )
        .getCount();
    }

    return this.txRepo.count({ where });
  }

  /**
   * Get bonus transactions for user with filters - optimized single query with count and conversion
   */
  async getTransactionsForUserWithFiltersOptimized(
    userId: string,
    page: number = 1,
    limit: number = 10,
    statuses?: BonusTransactionStatusEnum[],
    bonusType?: string,
  ): Promise<{ data: any[]; total: number }> {
    const queryBuilder = this.txRepo
      .createQueryBuilder('bonus')
      .where('bonus.userId = :userId', { userId });

    // Add status filter (statuses is always an array or undefined)
    if (statuses && statuses.length > 0) {
      queryBuilder.andWhere('bonus.status IN (:...statuses)', { statuses });
    }

    // Add bonus type filter
    if (bonusType) {
      queryBuilder.andWhere('bonus.bonusType = :bonusType', { bonusType });
    }

    // Get data and count in one efficient operation
    const [data, total] = await queryBuilder
      .orderBy('bonus.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Convert amounts from cents to dollars for frontend
    const convertedData = data.map((entity) => ({
      ...entity,
      amount: (parseFloat(entity.amount) / 100).toFixed(2), // Convert cents to dollars
    }));

    return { data: convertedData, total };
  }

  /**
   * Get bonuses with filters for admin panel
   */
  async getBonusesWithFilters(filters: IBonusFilters): Promise<IBonusesWithFiltersResult> {
    const queryBuilder = this.txRepo.createQueryBuilder('bonus');

    if (filters.status?.length) {
      queryBuilder.andWhere('bonus.status IN (:...statuses)', { statuses: filters.status });
    }

    if (filters.bonusType?.length) {
      queryBuilder.andWhere('bonus.bonusType IN (:...types)', { types: filters.bonusType });
    }

    if (filters.userId) {
      queryBuilder.andWhere('bonus.userId = :userId', { userId: filters.userId });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('bonus.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('bonus.createdAt <= :dateTo', { dateTo: filters.dateTo });
    }

    const total = await queryBuilder.getCount();

    const bonuses = await queryBuilder
      .orderBy('bonus.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();

    return { bonuses, total };
  }

  /**
   * Cancel multiple bonuses with metadata tracking
   */
  async cancelBonusesBatch(
    bonusIds: string[],
    adminId: string,
    reason: string,
  ): Promise<ICancelBonusesResult> {
    const results: ICancelBonusesResult = { success: 0, failed: [] };

    for (const bonusId of bonusIds) {
      try {
        const bonus = await this.txRepo.findOne({
          where: { id: bonusId, status: BonusTransactionStatusEnum.PENDING },
        });

        if (!bonus) {
          results.failed.push(bonusId);
          continue;
        }

        // Update the bonus entity
        bonus.status = BonusTransactionStatusEnum.CANCELED;
        bonus.updatedBy = adminId;
        bonus.metadata = {
          cancellationReason: reason,
          ...(bonus.metadata || {}),
        } as any;

        await this.txRepo.save(bonus);
        results.success++;
      } catch (error) {
        this.logger.error(`Failed to cancel bonus ${bonusId}:`, error);
        results.failed.push(bonusId);
      }
    }

    this.logger.log(
      `Batch cancel completed: ${results.success} success, ${results.failed.length} failed`,
    );
    return results;
  }

  /**
   * Check if user has already received a rank-up bonus for the specified major rank
   *
   * @param userId - User ID to check
   * @param majorRank - Major rank name (e.g., 'Platinum', 'Gold')
   * @returns Promise<boolean> - true if bonus already exists, false otherwise
   */
  async hasExistingRankUpBonus(userId: string, majorRank: string): Promise<boolean> {
    const existingBonus = await this.txRepo.findOne({
      where: {
        userId,
        bonusType: BonusTypeEnum.RANK_UP,
        status: In([BonusTransactionStatusEnum.PENDING, BonusTransactionStatusEnum.CLAIMED]),
      },
    });

    // Check if any bonus has the target major rank in metadata
    if (!existingBonus) {
      return false;
    }

    // For more precise check, we could have multiple bonuses, so let's find all
    const allRankUpBonuses = await this.txRepo.find({
      where: {
        userId,
        bonusType: BonusTypeEnum.RANK_UP,
        status: In([BonusTransactionStatusEnum.PENDING, BonusTransactionStatusEnum.CLAIMED]),
      },
    });

    // Check if any of these bonuses has the target major rank
    return allRankUpBonuses.some(
      (bonus) => bonus.metadata?.to === majorRank || bonus.metadata?.targetMajor === majorRank,
    );
  }

  /**
   * Claim a pending bonus for a user
   *
   * Currency Selection Logic:
   * - WEEKLY_RACE_PRIZE: Always credited to BTC wallet (to complicate withdrawals)
   * - All other bonus types: Credited to user's primary wallet asset
   * - Fallback: If no primary wallet exists, defaults to BTC
   *
   * Race Condition Protection:
   * - Uses distributed lock to prevent concurrent claims across multiple instances
   * - Lock resource: bonus:transaction:${userId}:${bonusId}
   * - Lock TTL: 5000ms
   * - Database transaction with pessimistic write lock provides additional safety
   * - Atomic check-and-update prevents multiple claims of same bonus
   *
   * @param userId - User ID claiming the bonus
   * @param id - Bonus transaction ID
   * @returns Updated bonus transaction entity
   */
  async claim(userId: string, id: string): Promise<BonusTransactionEntity> {
    // Acquire distributed lock to prevent concurrent bonus claims
    const lockResource = LockKeyBuilder.bonusTransaction(userId, id);

    try {
      return await this.distributedLockService.withLock(
        lockResource,
        LockTTL.STANDARD_OPERATION, // Bonus operation with DB updates
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Find bonus with pessimistic write lock to prevent race conditions
            const tx = await queryRunner.manager.findOne(BonusTransactionEntity, {
              where: { id, userId },
              lock: { mode: 'pessimistic_write' },
            });

            if (!tx) {
              throw new NotFoundException('Bonus transaction not found');
            }

            // Atomic check - if not PENDING, another request already claimed it
            if (tx.status !== BonusTransactionStatusEnum.PENDING) {
              throw new BadRequestException('Bonus already claimed');
            }

            // Determine asset based on bonus type
            // Prefer saved asset in metadata to ensure determinism regardless of later currency switches
            let asset: AssetTypeEnum | undefined = tx.metadata?.asset as AssetTypeEnum | undefined;
            if (tx.bonusType === BonusTypeEnum.WEEKLY_RACE_PRIZE) {
              // Weekly race prizes always go to BTC
              asset = AssetTypeEnum.BTC;
            }
            if (!asset) {
              // Default: use user's current primary wallet asset
              const primaryWallet = await this.balanceService.getPrimaryWallet(userId);
              asset = primaryWallet ? primaryWallet.asset : AssetTypeEnum.BTC; // fallback to BTC
            }

            // tx.amount is in cents, convert to crypto asset
            const amountAsset = this.cryptoConverter.fromCents(tx.amount, asset);

            // Credit bonus to user balance
            try {
              const metadata: Record<string, unknown> = {
                ...(tx.metadata || {}),
                reason: tx.bonusType,
              };

              const result = await this.balanceService.updateBalance({
                operation: BalanceOperationEnum.BONUS,
                operationId: tx.id,
                userId,
                amount: new BigNumber(amountAsset),
                asset,
                description: `Claim bonus ${tx.id} (${(parseFloat(tx.amount) / 100).toFixed(2)} USD)`,
                metadata,
              });

              if (!result.success) {
                this.logger.error(
                  `Balance update failed for bonus claim ${tx.id}: ${result.error}`,
                );
                throw new BadRequestException(`Failed to update balance: ${result.error}`);
              }
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : 'Unknown error';
              const errorStack = err instanceof Error ? err.stack : undefined;

              this.logger.error(
                `Exception during balance update for bonus claim ${tx.id}: ${errorMessage}`,
                errorStack,
              );
              throw new BadRequestException(`Failed to process bonus claim: ${errorMessage}`);
            }

            // Atomically update bonus status to CLAIMED
            tx.status = BonusTransactionStatusEnum.CLAIMED;
            tx.claimedAt = new Date();
            tx.updatedBy = userId;
            const savedTx = await queryRunner.manager.save(tx);

            await queryRunner.commitTransaction();

            this.logger.log(
              `Bonus claim successful: ${tx.id} for user ${userId} (${(parseFloat(tx.amount) / 100).toFixed(2)} USD)`,
              { userId, bonusId: tx.id, amount: tx.amount, bonusType: tx.bonusType },
            );

            // Send notification after successful claim
            void this.bonusNotificationService.createBonusClaimedNotification(savedTx);

            return savedTx;
          } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
          } finally {
            await queryRunner.release();
          }
        },
        {
          retryCount: 3,
          retryDelay: 100,
          retryJitter: 50,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for bonus claim', {
          userId,
          bonusId: id,
          lockResource,
        });
        throw new BadRequestException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }
}
