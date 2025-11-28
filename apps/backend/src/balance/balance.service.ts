import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssetTypeEnum,
  BalanceHistoryEntity,
  BalanceHistoryStatusEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  BalanceStatisticEntity,
  BalanceVaultEntity,
  BalanceVaultHistoryEntity,
  BalanceWalletEntity,
  BetSourceEnum,
  LimitPeriodEnum,
  PlatformTypeEnum,
  SelfExclusionTypeEnum,
  VaultDirectionEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { ERROR_MESSAGES } from '../common/constants/error-messages';
import { fireblocksConfig } from '../payments/config/fireblocks.config';
import { DailyGamblingStatsService } from '../users/daily-gambling-stats.service';
import { PublicUserProfileDto } from '../users/dto/public-user-profile.dto';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../websocket/services/notification.service';
import { BalanceWalletDto } from './dto/balance-wallet.dto';
import { CreateTipInput, TipResultDto } from './dto/create-tip.input';
import {
  ExtendedBalanceHistoryItemDto,
  ExtendedBalanceHistoryResponseDto,
} from './dto/extended-balance-history.dto';
import { BalanceHistorySortEnum, GetBalanceHistoryDto } from './dto/get-balance-history.dto';
import { GetBalanceStatisticsDto } from './dto/get-balance-statistics.dto';
import { GetDailyStatisticsDto } from './dto/get-daily-statistics.dto';
import { UpdateBalanceDto, UpdateFiatBalanceDto } from './dto/update-balance.dto';
import { IVaultInfo, IVaultTransferResult } from './interfaces/vault.interface';

import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { LockTTL } from '../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../common/services/distributed-lock.service';
import { UserCacheService } from '../common/services/user-cache.service';
import { LockKeyBuilder } from '../common/utils/lock-key-builder';
import { AssetLimitDto } from '../payments/dto/asset-limits-response.dto';
import {
  AssetNotSupportedError,
  BalanceOperationError,
  DailyLimitReachedError,
  DepositAmountTooLargeError,
  DepositAmountTooSmallError,
  InsufficientBalanceError,
  InvalidOperationError,
  OperationExistsError,
  PrecisionExceedsMaximumError,
  WithdrawAmountTooLargeError,
  WithdrawAmountTooSmallError,
} from './errors/balance-operation.errors';
import { CryptoConverterService } from './services/crypto-converter.service';

/**
 * BalanceService - Manages user balance operations with distributed locking
 *
 * LOCK ORDERING REQUIREMENTS (to prevent deadlocks):
 * 1. User-level locks must be acquired before system-level locks
 * 2. When multiple user locks are needed, acquire in alphabetical order by lock key
 * 3. Never acquire locks in different orders across different methods
 * 4. Always use the same lock key for the same resource to ensure atomicity
 *
 * LOCK KEY PATTERNS:
 * - balance:user:{userId}:{asset}
 *   Purpose: Single user balance operations (DEPOSIT, WITHDRAW, BET, WIN, REFUND)
 *   Used by: updateBalance() for single operations, updateBalanceBatch() for batch operations
 *   Scope: Per user-asset pair
 *   TTL: FAST_OPERATION for single, BATCH_OPERATION for batch
 *
 * - balance:vault:{userId}:{asset}
 *   Purpose: Vault operations (DEPOSIT AND WITHDRAW use same key for atomicity)
 *   Used by: vaultDeposit(), vaultWithdraw()
 *   Scope: Per user-asset vault
 *   TTL: STANDARD_OPERATION
 *   CRITICAL: Both deposit and withdraw operations use the SAME lock key to prevent
 *            race conditions between concurrent vault operations. This ensures that
 *            vault balance reads and updates are atomic across all vault operations.
 *
 * - balance:switch:{userId}
 *   Purpose: Wallet switching operations (change primary wallet)
 *   Used by: switchPrimaryWallet()
 *   Scope: Per user (affects all wallets)
 *   TTL: FAST_OPERATION
 *
 * - balance:tip:{userId1}:{userId2}
 *   Purpose: Multi-user tip operations (transfer between users)
 *   Used by: tip()
 *   Scope: Two users (sender and receiver, sorted alphabetically to prevent deadlock)
 *   TTL: COMPLEX_OPERATION
 *   CRITICAL: User IDs are sorted alphabetically before creating lock key to ensure
 *            consistent lock acquisition order when users tip each other simultaneously.
 *
 * LOCK ACQUISITION PATTERNS:
 * - Single user operations: Acquire user-level lock (balance:user:*)
 * - Multi-user operations: Sort user IDs alphabetically, then acquire lock
 * - Vault operations: Use single consolidated lock for both deposit/withdraw
 * - System-wide operations: Not currently implemented (would use system-level lock)
 *
 * ATOMICITY GUARANTEES:
 * - All balance operations for the same user-asset use the same lock key
 * - Vault operations (deposit/withdraw) share the same lock to prevent TOCTOU races
 * - Multi-user operations (tips) use sorted lock keys to prevent deadlocks
 * - Batch operations use the same lock as single operations for consistency
 *
 * ERROR HANDLING:
 * - Lock acquisition failures throw LockAcquisitionException
 * - User-friendly error message: "The system is currently busy. Please try again in a moment."
 * - All lock failures are logged with context (userId, asset, operation, lockResource)
 *
 * @see DistributedLockService for lock implementation details
 * @see LockTTL for TTL constants
 */
@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);
  private readonly MAX_BALANCE = new BigNumber('999999999999.99999999');

  // Financial operation limits
  private readonly LIMITS: Record<
    AssetTypeEnum,
    {
      MIN_DEPOSIT: BigNumber;
      MAX_DEPOSIT: BigNumber;
      MIN_WITHDRAW: BigNumber;
      MAX_WITHDRAW: BigNumber;
      DAILY_WITHDRAW_LIMIT: BigNumber;
    }
  > = {
    [AssetTypeEnum.BTC]: {
      MIN_DEPOSIT: new BigNumber('0.00000001'), // 1 satoshi
      MAX_DEPOSIT: new BigNumber('100'), // 100 BTC per transaction
      MIN_WITHDRAW: new BigNumber('0.0001'), // 0.0001 BTC minimum withdrawal
      MAX_WITHDRAW: new BigNumber('10'), // 10 BTC per transaction
      DAILY_WITHDRAW_LIMIT: new BigNumber('50'), // 50 BTC per day
    },
    [AssetTypeEnum.ETH]: {
      MIN_DEPOSIT: new BigNumber('0.000001'), // 1 gwei
      MAX_DEPOSIT: new BigNumber('1000'), // 1000 ETH per transaction
      MIN_WITHDRAW: new BigNumber('0.001'), // 0.001 ETH minimum withdrawal
      MAX_WITHDRAW: new BigNumber('100'), // 100 ETH per transaction
      DAILY_WITHDRAW_LIMIT: new BigNumber('500'), // 500 ETH per day
    },
    [AssetTypeEnum.USDT]: {
      MIN_DEPOSIT: new BigNumber('1'), // 1 USDT
      MAX_DEPOSIT: new BigNumber('1000000'), // 1M USDT per transaction
      MIN_WITHDRAW: new BigNumber('10'), // 10 USDT minimum withdrawal
      MAX_WITHDRAW: new BigNumber('100000'), // 100K USDT per transaction
      DAILY_WITHDRAW_LIMIT: new BigNumber('500000'), // 500K USDT per day
    },
    [AssetTypeEnum.USDC]: {
      MIN_DEPOSIT: new BigNumber('1'), // 1 USDC
      MAX_DEPOSIT: new BigNumber('1000000'), // 1M USDC per transaction
      MIN_WITHDRAW: new BigNumber('10'), // 10 USDC minimum withdrawal
      MAX_WITHDRAW: new BigNumber('100000'), // 100K USDC per transaction
      DAILY_WITHDRAW_LIMIT: new BigNumber('500000'), // 500K USDC per day
    },
    [AssetTypeEnum.LTC]: {
      MIN_DEPOSIT: new BigNumber('0.00000001'),
      MAX_DEPOSIT: new BigNumber('1000'),
      MIN_WITHDRAW: new BigNumber('0.001'),
      MAX_WITHDRAW: new BigNumber('100'),
      DAILY_WITHDRAW_LIMIT: new BigNumber('500'),
    },
    [AssetTypeEnum.DOGE]: {
      MIN_DEPOSIT: new BigNumber('1'),
      MAX_DEPOSIT: new BigNumber('1000000'),
      MIN_WITHDRAW: new BigNumber('10'),
      MAX_WITHDRAW: new BigNumber('100000'),
      DAILY_WITHDRAW_LIMIT: new BigNumber('500000'),
    },
    [AssetTypeEnum.TRX]: {
      MIN_DEPOSIT: new BigNumber('1'),
      MAX_DEPOSIT: new BigNumber('1000000'),
      MIN_WITHDRAW: new BigNumber('10'),
      MAX_WITHDRAW: new BigNumber('100000'),
      DAILY_WITHDRAW_LIMIT: new BigNumber('500000'),
    },
    [AssetTypeEnum.XRP]: {
      MIN_DEPOSIT: new BigNumber('1'),
      MAX_DEPOSIT: new BigNumber('1000000'),
      MIN_WITHDRAW: new BigNumber('10'),
      MAX_WITHDRAW: new BigNumber('100000'),
      DAILY_WITHDRAW_LIMIT: new BigNumber('500000'),
    },
    [AssetTypeEnum.SOL]: {
      MIN_DEPOSIT: new BigNumber('0.001'),
      MAX_DEPOSIT: new BigNumber('10000'),
      MIN_WITHDRAW: new BigNumber('0.01'),
      MAX_WITHDRAW: new BigNumber('1000'),
      DAILY_WITHDRAW_LIMIT: new BigNumber('5000'),
    },
  };

  constructor(
    private dataSource: DataSource,
    private cryptoConverter: CryptoConverterService,
    private eventEmitter: EventEmitter2,
    private notificationService: NotificationService,
    private selfExclusionService: SelfExclusionService,
    private dailyGamblingStatsService: DailyGamblingStatsService,
    private distributedLockService: DistributedLockService,
    private affiliateCommissionService: AffiliateCommissionService,
    @Inject(forwardRef(() => UsersService)) private readonly usersService?: UsersService,
    private readonly userCacheService?: UserCacheService,
  ) {
    // Fixed: Increase EventEmitter limit to prevent memory leaks during high-frequency operations
    this.eventEmitter.setMaxListeners(100); // Increase from default 10 to 100
  }

  /**
   * Emit event with retry logic for reliability
   */
  private async emitWithRetry(
    eventName: string,
    payload: any,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<void> {
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        await this.eventEmitter.emitAsync(eventName, payload);
        return; // Success, exit
      } catch (error) {
        this.logger.warn(`Event emission attempt ${attempt}/${maxRetries} failed`, {
          eventName,
          error: error instanceof Error ? error.message : String(error),
          operationId: payload.operationId,
        });

        if (attempt === maxRetries) {
          throw error; // Final attempt failed, throw error
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        attempt++;
      }
    }
  }

  /**
   * Format balance to remove trailing zeros
   */
  formatBalance(balance: string): string {
    // Protection against invalid values
    if (!balance || balance === '' || balance === null || balance === undefined) {
      return '0';
    }

    const balanceBN = new BigNumber(balance);

    // Check for NaN
    if (balanceBN.isNaN()) {
      this.logger.error(`Balance is NaN: raw value was '${balance}'`);
      return '0';
    }

    return balanceBN.toString();
  }

  async getHistoryByOperationId(operationId: string): Promise<BalanceHistoryEntity | null> {
    try {
      const historyRepo = this.dataSource.getRepository(BalanceHistoryEntity);
      return await historyRepo.findOne({ where: { operationId } });
    } catch (error) {
      this.logger.error(`Failed to get history by operation ID ${operationId}:`, error);
      return null;
    }
  }

  async getBalance(
    userId: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<string> {
    const wallet = await this.getOrCreateWallet(userId, asset, queryRunner);
    return this.formatBalance(wallet.balance);
  }

  /**
   * Update user balance (creates its own transaction)
   */
  async updateBalance(dto: UpdateBalanceDto): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }>;

  /**
   * Update user balance with existing transaction (uses provided queryRunner)
   */
  async updateBalance(
    dto: UpdateBalanceDto,
    queryRunner: QueryRunner,
  ): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }>;

  /**
   * Batch update user balance operations (creates its own transaction)
   */
  async updateBalance(dtos: UpdateBalanceDto[]): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }>;

  /**
   * Batch update user balance operations with existing transaction (uses provided queryRunner)
   */
  async updateBalance(
    dtos: UpdateBalanceDto[],
    queryRunner: QueryRunner,
  ): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }>;

  async updateBalance(
    dto: UpdateBalanceDto | UpdateBalanceDto[],
    providedQueryRunner?: QueryRunner,
  ): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }> {
    // If array is passed, handle as batch operation
    if (Array.isArray(dto)) {
      return this.updateBalanceBatch(dto, providedQueryRunner);
    }

    // Single operation logic with distributed locking
    // Lock resource key: balance:user:{userId}:{asset} for user-asset level locking
    const lockResource = LockKeyBuilder.balanceUser(dto.userId, dto.asset);
    const lockTTL = LockTTL.FAST_OPERATION; // Simple balance update

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for balance update`, {
          userId: dto.userId,
          asset: dto.asset,
          operation: dto.operation,
          operationId: dto.operationId,
          lockResource,
        });

        // Use provided queryRunner or create our own
        const usingProvidedQueryRunner = !!providedQueryRunner;
        const queryRunner = providedQueryRunner || this.dataSource.createQueryRunner();
        let transactionStarted = false;

        try {
          // Check if the user has reached their loss or wager limits before allowing a bet
          if (dto.operation === BalanceOperationEnum.BET) {
            // Extract platformType for limit checks
            const platformType =
              (dto.metadata?.platformType as PlatformTypeEnum) || PlatformTypeEnum.PLATFORM;

            await this.checkLossLimits(dto.userId, dto.amount, dto.asset);
            await this.checkWagerLimits(dto.userId, dto.amount, platformType);
          }

          // Validate financial limits before starting a transaction
          this.validateFinancialOperation(dto);

          // Only connect and start transaction if using our own queryRunner
          if (!usingProvidedQueryRunner) {
            await queryRunner.connect();
            await queryRunner.startTransaction();
            transactionStarted = true;
          }

          // Check if operation already exists (idempotency)
          // This check is now safe from TOCTOU race condition due to distributed lock
          // With composite PK (operationId, operation), check both fields
          const existingOperation = await queryRunner.manager.findOne(BalanceHistoryEntity, {
            where: {
              operationId: dto.operationId,
              operation: dto.operation,
            },
          });

          if (existingOperation) {
            this.logger.log(
              `Operation ${dto.operationId} already exists, returning existing result`,
            );
            throw new OperationExistsError();
          }

          // Additional daily limit checks for withdrawals
          if (dto.operation === BalanceOperationEnum.WITHDRAW) {
            await this.checkDailyWithdrawLimit(queryRunner, dto);
          }

          // No locks needed - atomic operations handle concurrency

          // Update wallet and create a history record
          const updatedWallet = await this.updateWalletAndHistoryAtomic(queryRunner, dto);

          // Update statistics (already locked)
          await this.updateStatisticsAtomic(queryRunner, dto);

          // Update daily gambling stats for BET and WIN operations
          if (
            dto.operation === BalanceOperationEnum.BET ||
            dto.operation === BalanceOperationEnum.WIN
          ) {
            // Default to PLATFORM type if not specified
            const platformType =
              (dto.metadata?.platformType as PlatformTypeEnum) || PlatformTypeEnum.PLATFORM;

            // For BET operations, update wager amount
            if (dto.operation === BalanceOperationEnum.BET) {
              await this.dailyGamblingStatsService.updateStats(
                dto.userId,
                platformType,
                dto.amount.toNumber(),
                0, // No win amount for BET operations
              );
            }

            // For WIN operations, update win amount
            if (dto.operation === BalanceOperationEnum.WIN) {
              await this.dailyGamblingStatsService.updateStats(
                dto.userId,
                platformType,
                0, // No wager amount for WIN operations
                dto.amount.toNumber(),
              );
            }
          }

          // Update daily deposit stats for DEPOSIT operations
          if (dto.operation === BalanceOperationEnum.DEPOSIT) {
            // Default to PLATFORM type if not specified
            const platformType =
              (dto.metadata?.platformType as PlatformTypeEnum) || PlatformTypeEnum.PLATFORM;

            // Update deposit amount
            await this.dailyGamblingStatsService.updateDepositStats(
              dto.userId,
              platformType,
              dto.amount.toNumber(),
            );

            // Send notification asynchronously to avoid blocking the main flow
            this.notificationService
              .sendToUserAndSave(dto.userId, {
                type: 'deposit',
                title: 'Deposit Successful',
                message: `Your deposit of ${dto.amount.toString()} ${dto.asset} has been processed successfully.`,
                data: {
                  amount: dto.amount.toString(),
                  asset: dto.asset,
                  transactionId: dto.operationId,
                  balance: updatedWallet.balance,
                },
              })
              .catch((error) => {
                this.logger.error(`Failed to send deposit notification for user ${dto.userId}`, {
                  userId: dto.userId,
                  operationId: dto.operationId,
                  error: error instanceof Error ? error.message : 'Unknown error',
                });
              });
          }

          // Accumulate affiliate commission BEFORE commit (inside transaction for atomicity)
          // Skip commission for SPORTSBOOK bets - they can be cancelled/voided before settlement
          // Commission is paid only after WIN | LOST to prevent paying for cancelled bets
          if (
            dto.operation === BalanceOperationEnum.BET &&
            dto.metadata?.source !== BetSourceEnum.SPORTSBOOK
          ) {
            const houseEdge = dto.houseEdge || 1;
            await this.affiliateCommissionService.accumulateCommission(
              dto.userId,
              dto.asset,
              dto.amount.toString(),
              houseEdge,
              queryRunner,
            );
          }

          // Handle REFUND operations: reverse affiliate commission
          if (dto.operation === BalanceOperationEnum.REFUND) {
            await this.affiliateCommissionService.accumulateCommission(
              dto.userId,
              dto.asset,
              (-parseFloat(dto.amount.toString())).toString(),
              1,
              queryRunner,
            );
          }

          // Only commit if using our own queryRunner
          if (!usingProvidedQueryRunner) {
            await queryRunner.commitTransaction();
          }

          // Emit events AFTER transaction commit to ensure data consistency
          if (
            dto.operation === BalanceOperationEnum.BET &&
            dto.metadata?.source !== BetSourceEnum.SPORTSBOOK
          ) {
            const betAmountCents = this.cryptoConverter.toCents(dto.amount.toString(), dto.asset);
            this.emitWithRetry('bet.confirmed', {
              userId: dto.userId,
              betAmount: dto.amount.toString(),
              betAmountCents,
              asset: dto.asset,
              operationId: dto.operationId,
              houseEdge: dto.houseEdge,
              metadata: dto.metadata,
            }).catch((error) => {
              this.logger.error('Failed to emit bet.confirmed event after retries', {
                error,
                operationId: dto.operationId,
              });
            });
          }

          if (dto.operation === BalanceOperationEnum.REFUND) {
            const refundAmountCents = this.cryptoConverter.toCents(
              dto.amount.toString(),
              dto.asset,
            );
            this.emitWithRetry('bet.refunded', {
              userId: dto.userId,
              refundAmount: dto.amount.toString(),
              refundAmountCents,
              asset: dto.asset,
              operationId: dto.operationId,
              description: dto.description,
              metadata: dto.metadata,
            }).catch((error) => {
              this.logger.error('Failed to emit bet.refunded event after retries', {
                error,
                operationId: dto.operationId,
              });
            });
          }

          // Send balance update notification to user (faster without setImmediate)
          const formattedBalance = this.formatBalance(updatedWallet.balance);
          this.notificationService.sendToUser(dto.userId, {
            type: 'balance_update',
            title: 'Balance Updated',
            message: `Your ${dto.asset} balance has been updated`,
            data: {
              operation: dto.operation,
              asset: dto.asset,
              amount: dto.amount.toString(),
              newBalance: formattedBalance,
              operationId: dto.operationId,
              shouldSync: dto?.metadata?.source === BetSourceEnum.SPORTSBOOK,
            },
          });

          return {
            success: true,
            status: BalanceOperationResultEnum.SUCCESS,
            balance: formattedBalance,
          };
        } catch (error: unknown) {
          // Only rollback if we started the transaction ourselves
          if (!usingProvidedQueryRunner && transactionStarted) {
            await queryRunner.rollbackTransaction();
          }

          // Re-throw ForbiddenException for loss limit errors
          if (error instanceof ForbiddenException) {
            throw error;
          }

          if (error instanceof BalanceOperationError) {
            this.logger.error(`Balance operation error: ${error.message}`, {
              operation: dto.operation,
              userId: dto.userId,
              amount: String(dto.amount),
              asset: dto.asset,
              errorCode: error.code,
              errorName: error.name,
            });

            return {
              success: false,
              status: error.code,
              balance: '0',
              error: error.message,
            };
          }

          // Handle other errors
          let status = BalanceOperationResultEnum.FAILED;
          let errorMessage: string = ERROR_MESSAGES.SYSTEM.FAILED_TO_UPDATE_BALANCE;

          if (error instanceof Error) {
            if (error.message.includes('transaction')) {
              status = BalanceOperationResultEnum.DATABASE_TRANSACTION_ERROR;
              errorMessage = ERROR_MESSAGES.SYSTEM.DATABASE_TRANSACTION_ERROR;
            }
          }

          this.logger.error(`Failed to update balance: ${errorMessage}`, {
            operation: dto.operation,
            userId: dto.userId,
            amount: String(dto.amount),
            asset: dto.asset,
            error: error instanceof Error ? error.message : String(error),
            status,
          });

          return {
            success: false,
            status,
            balance: '0',
            error: errorMessage,
          };
        } finally {
          // Only release queryRunner if we created it ourselves
          if (!usingProvidedQueryRunner) {
            await queryRunner.release();
          }
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
   * Batch update balance operations in a single transaction
   * Optimized for BET+WIN operations to reduce transaction time
   */
  private async updateBalanceBatch(
    dtos: UpdateBalanceDto[],
    providedQueryRunner?: QueryRunner,
  ): Promise<{
    success: boolean;
    status: BalanceOperationResultEnum;
    balance: string;
    error?: string;
  }> {
    if (dtos.length === 0) {
      throw new BadRequestException('Batch operation requires at least one operation');
    }

    // Validate batch size (max 50 operations)
    if (dtos.length > 50) {
      throw new BadRequestException('Batch operation cannot exceed 50 operations');
    }

    // Validate that all operations are for the same user and asset
    const firstUserId = dtos[0].userId;
    const firstAsset = dtos[0].asset;
    if (!dtos.every((dto) => dto.userId === firstUserId && dto.asset === firstAsset)) {
      throw new BadRequestException('All batch operations must be for the same user and asset');
    }

    // Lock resource key: balance:user:{userId}:{asset} for all user balance operations
    // Use the SAME lock key as single operations to ensure complete atomicity
    const lockResource = LockKeyBuilder.balanceUser(firstUserId, firstAsset);
    const lockTTL = LockTTL.BATCH_OPERATION; // Batch operations with multiple steps

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        const batchStartTime = Date.now();
        this.logger.debug(`Acquired distributed lock for batch balance update`, {
          userId: firstUserId,
          asset: firstAsset,
          operationCount: dtos.length,
          operations: dtos.map((dto) => dto.operation),
          lockResource,
        });

        // Use provided queryRunner or create our own
        const usingProvidedQueryRunner = !!providedQueryRunner;
        const queryRunner = providedQueryRunner || this.dataSource.createQueryRunner();
        let transactionStarted = false;

        try {
          // Validate all operations first
          for (const dto of dtos) {
            this.validateFinancialOperation(dto);

            // Check loss and wager limits only for BET operations
            if (dto.operation === BalanceOperationEnum.BET) {
              // Extract platformType for limit checks
              const platformType =
                (dto.metadata?.platformType as PlatformTypeEnum) || PlatformTypeEnum.PLATFORM;

              await this.checkLossLimits(dto.userId, dto.amount, dto.asset);
              await this.checkWagerLimits(dto.userId, dto.amount, platformType);
            }
          }

          // Only connect and start transaction if using our own queryRunner
          if (!usingProvidedQueryRunner) {
            await queryRunner.connect();
            await queryRunner.startTransaction();
            transactionStarted = true;
          }

          // Check idempotency for all operations
          // This check is now safe from TOCTOU race condition due to distributed lock
          for (const dto of dtos) {
            const existingOperation = await queryRunner.manager.findOne(BalanceHistoryEntity, {
              where: { operationId: dto.operationId },
            });

            if (existingOperation) {
              this.logger.log(
                `Operation ${dto.operationId} already exists, returning existing result`,
              );
              throw new OperationExistsError();
            }
          }

          // Additional daily limit checks for withdrawals
          for (const dto of dtos) {
            if (dto.operation === BalanceOperationEnum.WITHDRAW) {
              await this.checkDailyWithdrawLimit(queryRunner, dto);
            }
          }

          let finalWallet: BalanceWalletEntity | null = null;
          const walletResults: Map<string, BalanceWalletEntity> = new Map();

          // Process all operations in sequence within the same transaction
          for (const dto of dtos) {
            // Update wallet and create history record for each operation
            finalWallet = await this.updateWalletAndHistoryAtomic(queryRunner, dto);

            // Store result for each operation
            walletResults.set(dto.operationId, finalWallet);

            // Update statistics for each operation
            await this.updateStatisticsAtomic(queryRunner, dto);
          }

          // Filter regular bets (non-SPORTSBOOK)
          const regularBets = dtos.filter(
            (dto) =>
              dto.operation === BalanceOperationEnum.BET &&
              dto.metadata?.source !== BetSourceEnum.SPORTSBOOK,
          );

          // Accumulate affiliate commission BEFORE commit (inside transaction for atomicity)
          // Skip commission for SPORTSBOOK bets - they can be cancelled/voided before settlement
          // Commission is paid only after WIN | LOST to prevent paying for cancelled bets
          for (const dto of regularBets) {
            const houseEdge = dto.houseEdge || 1;
            await this.affiliateCommissionService.accumulateCommission(
              dto.userId,
              dto.asset,
              dto.amount.toString(),
              houseEdge,
              queryRunner,
            );
          }

          // Only commit if using our own queryRunner
          if (!usingProvidedQueryRunner) {
            await queryRunner.commitTransaction();
          }

          // Log batch processing time
          const batchDuration = Date.now() - batchStartTime;
          this.logger.log(`Batch balance update completed`, {
            userId: firstUserId,
            asset: firstAsset,
            operationCount: dtos.length,
            operations: dtos.map((dto) => dto.operation),
            durationMs: batchDuration,
            finalBalance: this.formatBalance(finalWallet?.balance || '0'),
          });

          // Emit events after transaction commit (faster without setImmediate)
          for (const dto of regularBets) {
            // Send betAmount in native asset AND in cents (for race tracker)
            const betAmountCents = this.cryptoConverter.toCents(dto.amount.toString(), dto.asset);
            this.eventEmitter
              .emitAsync('bet.confirmed', {
                userId: dto.userId,
                betAmount: dto.amount.toString(),
                betAmountCents,
                asset: dto.asset,
                operationId: dto.operationId,
                houseEdge: dto.houseEdge,
                metadata: dto.metadata,
              })
              .catch((error) => {
                this.logger.error('Failed to emit bet.confirmed event', {
                  operationId: dto.operationId,
                  error: error.message,
                });
              });
          }

          // Send notifications for batch operations (faster without setImmediate)
          // Only send one final notification with WIN balance for [{BET}, {WIN}] operations
          if (finalWallet) {
            const formattedBalance = this.formatBalance(finalWallet.balance);
            const winDto = dtos.find((dto) => dto.operation === BalanceOperationEnum.WIN);
            const betDto = dtos.find((dto) => dto.operation === BalanceOperationEnum.BET);

            // For [{BET}, {WIN}] - show win notification with final balance
            if (winDto && betDto) {
              this.notificationService.sendToUser(winDto.userId, {
                type: 'balance_update',
                title: 'Bet Won!',
                message: `You won ${winDto.amount.toString()} ${winDto.asset}`,
                data: {
                  operation: BalanceOperationEnum.WIN,
                  asset: winDto.asset,
                  betAmount: betDto.amount.toString(),
                  winAmount: winDto.amount.toString(),
                  newBalance: formattedBalance, // Final balance after WIN
                  operationId: winDto.operationId,
                },
              });
            } else {
              // For other batch operations (or single operations in batch)
              const primaryDto = dtos[dtos.length - 1];
              this.notificationService.sendToUser(primaryDto.userId, {
                type: 'balance_update',
                title: 'Balance Updated',
                message: `Your ${primaryDto.asset} balance has been updated`,
                data: {
                  operation: primaryDto.operation,
                  asset: primaryDto.asset,
                  amount: primaryDto.amount.toString(),
                  newBalance: formattedBalance,
                  operationId: primaryDto.operationId,
                },
              });
            }
          }

          return {
            success: true,
            status: BalanceOperationResultEnum.SUCCESS,
            balance: this.formatBalance(finalWallet?.balance || '0'),
          };
        } catch (error: unknown) {
          // Only rollback if we started the transaction ourselves
          if (!usingProvidedQueryRunner && transactionStarted) {
            await queryRunner.rollbackTransaction();
          }

          // Re-throw ForbiddenException for loss limit errors
          if (error instanceof ForbiddenException) {
            throw error;
          }

          if (error instanceof BalanceOperationError) {
            this.logger.error(`Batch balance operation error: ${error.message}`, {
              operations: dtos.map((dto) => dto.operation),
              userId: firstUserId,
              errorCode: error.code,
              errorName: error.name,
            });

            return {
              success: false,
              status: error.code,
              balance: '0',
              error: error.message,
            };
          }

          // Handle other errors
          let status = BalanceOperationResultEnum.FAILED;
          let errorMessage: string = ERROR_MESSAGES.SYSTEM.FAILED_TO_UPDATE_BALANCE;

          if (error instanceof Error) {
            if (error.message.includes('transaction')) {
              status = BalanceOperationResultEnum.DATABASE_TRANSACTION_ERROR;
              errorMessage = ERROR_MESSAGES.SYSTEM.DATABASE_TRANSACTION_ERROR;
            }
          }

          this.logger.error(`Batch balance update failed for user ${firstUserId}`, {
            operations: dtos.map((dto) => dto.operation),
            userId: firstUserId,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });

          return {
            success: false,
            status,
            balance: '0',
            error: errorMessage,
          };
        } finally {
          // Only release queryRunner if we created it ourselves
          if (!usingProvidedQueryRunner) {
            await queryRunner.release();
          }
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for batch balance operation', {
          userId: firstUserId,
          asset: firstAsset,
          operationCount: dtos.length,
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

  validateFinancialOperation(dto: UpdateBalanceDto): void {
    const amount = new BigNumber(dto.amount);
    const assetLimits = this.LIMITS[dto.asset];

    if (!assetLimits) {
      throw new AssetNotSupportedError();
    }

    // Validate amount precision (max 8 decimal places for crypto)
    const decimalPlaces = amount.decimalPlaces();
    if (decimalPlaces !== null && decimalPlaces > 8) {
      throw new PrecisionExceedsMaximumError();
    }

    // Validate operation-specific limits
    switch (dto.operation) {
      case BalanceOperationEnum.DEPOSIT:
        if (amount.isLessThan(assetLimits.MIN_DEPOSIT)) {
          throw new DepositAmountTooSmallError();
        }
        if (amount.isGreaterThan(assetLimits.MAX_DEPOSIT)) {
          throw new DepositAmountTooLargeError();
        }
        break;

      case BalanceOperationEnum.WITHDRAW:
        if (amount.isLessThan(assetLimits.MIN_WITHDRAW)) {
          throw new WithdrawAmountTooSmallError();
        }
        if (amount.isGreaterThan(assetLimits.MAX_WITHDRAW)) {
          throw new WithdrawAmountTooLargeError();
        }
        break;

      case BalanceOperationEnum.BET:
        // Minimum bet validation
        if (!amount.eq(0) && amount.isLessThan(new BigNumber('0.00000001'))) {
          throw new InvalidOperationError(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
        }
        // Maximum bet validation (10% of max balance)
        if (amount.isGreaterThan(this.MAX_BALANCE.multipliedBy(0.1))) {
          throw new InvalidOperationError(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_LARGE);
        }
        break;
    }
  }

  /**
   * Get payment operation limits for all supported assets
   */
  getAssetLimits(): Record<string, AssetLimitDto> {
    const limits: Record<string, AssetLimitDto> = {};

    Object.entries(this.LIMITS).forEach(([asset, limitConfig]) => {
      limits[asset] = {
        MIN_DEPOSIT: limitConfig.MIN_DEPOSIT.toString(),
        MAX_DEPOSIT: limitConfig.MAX_DEPOSIT.toString(),
        MIN_WITHDRAW: limitConfig.MIN_WITHDRAW.toString(),
        MAX_WITHDRAW: limitConfig.MAX_WITHDRAW.toString(),
        DAILY_WITHDRAW_LIMIT: limitConfig.DAILY_WITHDRAW_LIMIT.toString(),
      };
    });

    return limits;
  }

  /**
   * Get payment operation limits for a specific asset
   */
  getAssetLimit(asset: AssetTypeEnum): AssetLimitDto | null {
    const limitConfig = this.LIMITS[asset];

    if (!limitConfig) {
      return null;
    }

    return {
      MIN_DEPOSIT: limitConfig.MIN_DEPOSIT.toString(),
      MAX_DEPOSIT: limitConfig.MAX_DEPOSIT.toString(),
      MIN_WITHDRAW: limitConfig.MIN_WITHDRAW.toString(),
      MAX_WITHDRAW: limitConfig.MAX_WITHDRAW.toString(),
      DAILY_WITHDRAW_LIMIT: limitConfig.DAILY_WITHDRAW_LIMIT.toString(),
    };
  }

  private async checkDailyWithdrawLimit(
    queryRunner: QueryRunner,
    dto: UpdateBalanceDto,
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's withdrawals for this user and asset
    const todayWithdrawals = await queryRunner.manager
      .createQueryBuilder(BalanceHistoryEntity, 'history')
      .where('history.userId = :userId', { userId: dto.userId })
      .andWhere('history.asset = :asset', { asset: dto.asset })
      .andWhere('history.operation = :operation', { operation: BalanceOperationEnum.WITHDRAW })
      .andWhere('history.createdAt >= :today', { today })
      .andWhere('history.createdAt < :tomorrow', { tomorrow })
      .getMany();

    const todayTotal = todayWithdrawals.reduce(
      (sum: BigNumber, withdrawal: BalanceHistoryEntity) =>
        sum.plus(new BigNumber(withdrawal.amount)),
      new BigNumber(0),
    );

    const newTotal: BigNumber = todayTotal.plus(new BigNumber(dto.amount));
    const dailyLimit = this.LIMITS[dto.asset].DAILY_WITHDRAW_LIMIT;

    if (newTotal.isGreaterThan(dailyLimit)) {
      const errorMessage = `${ERROR_MESSAGES.FINANCIAL.DAILY_WITHDRAW_LIMIT_EXCEEDED} (${todayTotal.toString()} + ${dto.amount} > ${dailyLimit.toString()})`;
      throw new DailyLimitReachedError(errorMessage);
    }
  }

  /**
   * Extend balance history items with user information
   * @private
   */
  private async extendBalanceHistoryWithUsers(
    items: BalanceHistoryEntity[],
    currentUserId: string,
  ): Promise<ExtendedBalanceHistoryItemDto[]> {
    if (!this.usersService || items.length === 0) {
      return items.map((item) => ({ ...item }));
    }

    // Collect all unique user IDs from metadata
    const userIds: Set<string> = new Set();

    items.forEach((item) => {
      if (item.metadata) {
        const { fromUserId, toUserId, userId: metadataUserId } = item.metadata;
        if (fromUserId && typeof fromUserId === 'string') {
          userIds.add(fromUserId);
        }
        if (toUserId && typeof toUserId === 'string') {
          userIds.add(toUserId);
        }
        if (metadataUserId && typeof metadataUserId === 'string') {
          userIds.add(metadataUserId);
        }
      }
    });

    // If no user IDs found, return items as-is
    if (userIds.size === 0) {
      return items.map((item) => ({ ...item }));
    }

    // Fetch all user profiles in a single batch query
    let userProfilesMap: { [userId: string]: PublicUserProfileDto } = {};

    try {
      const userProfilesArray = await this.usersService.getPublicUserProfiles(
        Array.from(userIds),
        currentUserId,
      );
      // Convert array to map for efficient lookup
      userProfilesMap = userProfilesArray.reduce(
        (map, profile) => {
          map[profile.userId] = profile;
          return map;
        },
        {} as { [userId: string]: PublicUserProfileDto },
      );
    } catch (error) {
      this.logger.warn('Failed to fetch user profiles for balance history:', error);
      // Continue without user information rather than failing
    }

    // Extend each item with user information
    return items.map((item): ExtendedBalanceHistoryItemDto => {
      const extendedItem: ExtendedBalanceHistoryItemDto = { ...item };

      if (item.metadata) {
        const { fromUserId, toUserId, userId: metadataUserId } = item.metadata;

        if (fromUserId && typeof fromUserId === 'string' && userProfilesMap[fromUserId]) {
          extendedItem.fromUser = userProfilesMap[fromUserId];
        }

        if (toUserId && typeof toUserId === 'string' && userProfilesMap[toUserId]) {
          extendedItem.toUser = userProfilesMap[toUserId];
        }

        if (metadataUserId && userProfilesMap[metadataUserId]) {
          extendedItem.user = userProfilesMap[metadataUserId];
        }
      }

      return extendedItem;
    });
  }

  /**
   * TODO: stub for fetching net wager for a given period
   */
  async getWagerForPeriod(userId: string, from: Date, to: Date): Promise<string> {
    const result = await this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .select(
        'COALESCE(SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END) - SUM(CASE WHEN history.operation = :refund THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END), 0)',
        'netWager',
      )
      .where('history.userId = :userId', { userId })
      .andWhere('history.createdAt >= :from', { from })
      .andWhere('history.createdAt <= :to', { to })
      .setParameters({
        bet: BalanceOperationEnum.BET,
        refund: BalanceOperationEnum.REFUND,
      })
      .getRawOne<{ netWager: string }>();

    return result?.netWager || '0';
  }

  async getBalanceHistory(
    userId: string,
    query: GetBalanceHistoryDto,
  ): Promise<ExtendedBalanceHistoryResponseDto> {
    const {
      asset,
      operation,
      limit = 20,
      offset = 0,
      sortBy = BalanceHistorySortEnum.DATE,
    } = query;

    const queryBuilder = this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .where('history.userId = :userId', { userId });

    if (asset) {
      queryBuilder.andWhere('history.asset = :asset', { asset });
    }

    if (operation) {
      if (Array.isArray(operation)) {
        queryBuilder.andWhere('history.operation IN (:...operations)', { operations: operation });
      } else {
        queryBuilder.andWhere('history.operation = :operation', { operation });
      }
    }

    // Sort by date (default) or amount
    if (sortBy === BalanceHistorySortEnum.AMOUNT) {
      queryBuilder.orderBy('history.amountCents', 'DESC');
    } else {
      queryBuilder.orderBy('history.createdAt', 'DESC');
    }

    const [items, total] = await queryBuilder.limit(limit).offset(offset).getManyAndCount();

    // Extend items with user information using batch fetching
    const extendedItems = await this.extendBalanceHistoryWithUsers(items, userId);

    return { items: extendedItems, total };
  }

  async getBalanceStatistics(
    userId: string,
    query: GetBalanceStatisticsDto,
  ): Promise<
    Array<{
      asset: AssetTypeEnum;
      totalDeposits: string;
      totalWithdrawals: string;
      totalBets: string;
      totalWins: string;
      netProfit: string;
    }>
  > {
    const { asset } = query;

    const queryBuilder = this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .select('history.asset', 'asset')
      .addSelect(
        'SUM(CASE WHEN history.operation = :deposit THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'totalDeposits',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :withdraw THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'totalWithdrawals',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'totalBets',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :win THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'totalWins',
      )
      .addSelect(
        '(SUM(CASE WHEN history.operation = :win THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END) - SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END))',
        'netProfit',
      )
      .where('history.userId = :userId', { userId })
      .setParameters({
        deposit: BalanceOperationEnum.DEPOSIT,
        withdraw: BalanceOperationEnum.WITHDRAW,
        bet: BalanceOperationEnum.BET,
        win: BalanceOperationEnum.WIN,
      })
      .groupBy('history.asset');

    if (asset) {
      queryBuilder.andWhere('history.asset = :asset', { asset });
    }

    return await queryBuilder.getRawMany<{
      asset: AssetTypeEnum;
      totalDeposits: string;
      totalWithdrawals: string;
      totalBets: string;
      totalWins: string;
      netProfit: string;
    }>();
  }

  async getDailyStatistics(
    userId: string,
    query: GetDailyStatisticsDto,
  ): Promise<
    Array<{
      date: string;
      asset: AssetTypeEnum;
      deposits: string;
      withdrawals: string;
      bets: string;
      wins: string;
    }>
  > {
    const { asset, startDate, endDate } = query;

    const queryBuilder = this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .select('DATE(history.createdAt)', 'date')
      .addSelect('history.asset', 'asset')
      .addSelect(
        'SUM(CASE WHEN history.operation = :deposit THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'deposits',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :withdraw THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'withdrawals',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'bets',
      )
      .addSelect(
        'SUM(CASE WHEN history.operation = :win THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END)',
        'wins',
      )
      .where('history.userId = :userId', { userId })
      .setParameters({
        deposit: BalanceOperationEnum.DEPOSIT,
        withdraw: BalanceOperationEnum.WITHDRAW,
        bet: BalanceOperationEnum.BET,
        win: BalanceOperationEnum.WIN,
      })
      .groupBy('DATE(history.createdAt), history.asset')
      .orderBy('DATE(history.createdAt)', 'DESC');

    if (asset) {
      queryBuilder.andWhere('history.asset = :asset', { asset });
    }

    if (startDate) {
      queryBuilder.andWhere('history.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('history.createdAt <= :endDate', { endDate });
    }

    return queryBuilder.getRawMany<{
      date: string;
      asset: AssetTypeEnum;
      deposits: string;
      withdrawals: string;
      bets: string;
      wins: string;
    }>();
  }

  /**
   * Get all wallets for a given user
   */
  async getWallets(userId: string): Promise<BalanceWalletDto[]> {
    const repo = this.dataSource.getRepository(BalanceWalletEntity);
    const wallets = await repo.find({ where: { userId } });
    return wallets.map((w) => ({
      userId: w.userId,
      asset: w.asset,
      balance: w.balance,
      isPrimary: w.isPrimary,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }

  /**
   * Get all vaults that have positive balances for a user
   */
  async getVaults(userId: string): Promise<IVaultInfo[]> {
    const repo = this.dataSource.getRepository(BalanceVaultEntity);
    const vaults = await repo.find({ where: { userId } });
    return vaults
      .filter((v) => new BigNumber(v.balance).isGreaterThan(0))
      .map((v) => ({
        asset: v.asset,
        balance: this.formatBalance(v.balance),
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      }));
  }

  async switchPrimaryWallet(userId: string, asset: AssetTypeEnum): Promise<BalanceWalletDto[]> {
    // Validate asset against configured supported assets
    const supportedAssets = fireblocksConfig().supportedAssets;

    if (!supportedAssets.includes(asset)) {
      throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.ASSET_NOT_SUPPORTED);
    }

    // Lock resource key: balance:switch:{userId} for wallet switching
    const lockResource = `balance:switch:${userId}`;
    const lockTTL = LockTTL.FAST_OPERATION; // Simple wallet switch operation

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for wallet switch`, {
          userId,
          asset,
          lockResource,
        });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const repo = queryRunner.manager.getRepository(BalanceWalletEntity);
          let wallets = await repo.find({ where: { userId }, lock: { mode: 'pessimistic_write' } });
          let targetWallet = wallets.find((w) => w.asset === asset);
          if (!targetWallet) {
            targetWallet = repo.create({ userId, asset, balance: '0', isPrimary: true });
            await repo.save(targetWallet);
            wallets = wallets.map((w) => ({ ...w, isPrimary: false }) as BalanceWalletEntity);
            wallets.push(targetWallet);
            await repo.save(wallets.filter((w) => w.asset !== asset));
          } else {
            wallets.forEach((w) => (w.isPrimary = w.asset === asset));
            await repo.save(wallets);
          }
          await queryRunner.commitTransaction();

          // Invalidate cached user context to ensure fresh primaryAsset on next request
          if (this.userCacheService) {
            await this.userCacheService.invalidateAllUserCaches(userId);
          }

          return wallets.map((w) => ({
            userId: w.userId,
            asset: w.asset,
            balance: w.balance,
            isPrimary: w.isPrimary,
            createdAt: w.createdAt,
            updatedAt: w.updatedAt,
          }));
        } catch {
          await queryRunner.rollbackTransaction();
          throw new InternalServerErrorException(ERROR_MESSAGES.SYSTEM.DATABASE_TRANSACTION_ERROR);
        } finally {
          await queryRunner.release();
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for wallet switch', {
          userId,
          asset,
          lockResource,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  private async getOrCreateWallet(
    userId: string,
    asset: AssetTypeEnum,
    queryRunner?: QueryRunner,
  ): Promise<BalanceWalletEntity> {
    queryRunner = queryRunner || this.dataSource.createQueryRunner();
    const repo = queryRunner.manager.getRepository(BalanceWalletEntity);

    let wallet = await repo.findOne({ where: { userId, asset } });

    if (!wallet) {
      const existingCount = await repo.count({ where: { userId } });
      wallet = repo.create({
        userId,
        asset,
        balance: '0',
        isPrimary: existingCount === 0,
      });
      await repo.save(wallet);
      this.logger.verbose('Wallet created', { userId, asset, wallet });
    }

    queryRunner.release().catch((e) => this.logger.error(e));
    return wallet;
  }

  /**
   * Vault deposit: move funds from wallet to vault atomically
   */
  async vaultDeposit(
    userId: string,
    input: {
      operationId: string;
      asset: AssetTypeEnum;
      amount: BigNumber;
      metadata?: Record<string, unknown>;
    },
  ): Promise<IVaultTransferResult> {
    // Lock resource key: balance:vault:{userId}:{asset} for ALL vault operations
    // Single lock key ensures complete atomicity and prevents race conditions between deposit/withdraw
    const lockResource = LockKeyBuilder.balanceVault(userId, input.asset);
    const lockTTL = LockTTL.STANDARD_OPERATION; // Vault operation with multiple queries

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for vault deposit`, {
          userId,
          asset: input.asset,
          amount: input.amount.toString(),
          operationId: input.operationId,
          lockResource,
        });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const debit = await this.updateBalance(
            {
              operation: BalanceOperationEnum.VAULT_DEPOSIT,
              operationId: input.operationId,
              userId,
              amount: input.amount,
              asset: input.asset,
              metadata: input.metadata,
              description: 'Vault Deposit',
            },
            queryRunner,
          );
          if (!debit.success) {
            throw new BadRequestException(debit.error || 'Vault deposit failed');
          }

          const vaultRepo = queryRunner.manager.getRepository(BalanceVaultEntity);
          const vault = await vaultRepo.findOne({
            where: { userId, asset: input.asset },
            lock: { mode: 'pessimistic_write' },
          });
          const prev = new BigNumber(vault?.balance || '0');
          if (!vault) {
            const created = vaultRepo.create({
              userId,
              asset: input.asset,
              balance: input.amount.toString(),
            });
            await vaultRepo.save(created);
            const vh = new BalanceVaultHistoryEntity();
            vh.operationId = input.operationId;
            vh.userId = userId;
            vh.asset = input.asset;
            vh.direction = VaultDirectionEnum.DEPOSIT;
            vh.amount = input.amount.toString();
            vh.previousVaultBalance = prev.toString();
            vh.metadata = input.metadata as Record<string, any> | undefined;
            await queryRunner.manager.save(vh);

            await queryRunner.commitTransaction();
            return {
              asset: input.asset,
              walletBalance: debit.balance,
              vaultBalance: this.formatBalance(created.balance),
            };
          } else {
            const nb = prev.plus(input.amount);
            await vaultRepo.update({ userId, asset: input.asset }, { balance: nb.toString() });
            const vh = new BalanceVaultHistoryEntity();
            vh.operationId = input.operationId;
            vh.userId = userId;
            vh.asset = input.asset;
            vh.direction = VaultDirectionEnum.DEPOSIT;
            vh.amount = input.amount.toString();
            vh.previousVaultBalance = prev.toString();
            vh.metadata = input.metadata as Record<string, any> | undefined;
            await queryRunner.manager.save(vh);

            await queryRunner.commitTransaction();
            return {
              asset: input.asset,
              walletBalance: debit.balance,
              vaultBalance: this.formatBalance(nb.toString()),
            };
          }
        } catch (e) {
          await queryRunner.rollbackTransaction();
          throw e;
        } finally {
          await queryRunner.release();
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for vault deposit', {
          userId,
          asset: input.asset,
          amount: input.amount.toString(),
          lockResource,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  /**
   * Vault withdraw: move funds from vault to wallet atomically
   */
  async vaultWithdraw(
    userId: string,
    input: {
      operationId: string;
      asset: AssetTypeEnum;
      amount: BigNumber;
      metadata?: Record<string, unknown>;
    },
  ): Promise<IVaultTransferResult> {
    // Lock resource key: balance:vault:{userId}:{asset} for ALL vault operations
    // Single lock key ensures complete atomicity and prevents race conditions between deposit/withdraw
    const lockResource = LockKeyBuilder.balanceVault(userId, input.asset);
    const lockTTL = LockTTL.STANDARD_OPERATION; // Vault operation with multiple queries

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for vault withdraw`, {
          userId,
          asset: input.asset,
          amount: input.amount.toString(),
          operationId: input.operationId,
          lockResource,
        });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const vaultRepo = queryRunner.manager.getRepository(BalanceVaultEntity);
          const vault = await vaultRepo.findOne({
            where: { userId, asset: input.asset },
            lock: { mode: 'pessimistic_write' },
          });
          const current = new BigNumber(vault?.balance || '0');
          if (current.isLessThan(input.amount)) {
            throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE);
          }
          const prev = current;
          const nb = current.minus(input.amount);
          if (!vault) {
            throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE);
          }
          await vaultRepo.update({ userId, asset: input.asset }, { balance: nb.toString() });

          const credit = await this.updateBalance(
            {
              operation: BalanceOperationEnum.VAULT_WITHDRAW,
              operationId: input.operationId,
              userId,
              amount: input.amount,
              asset: input.asset,
              metadata: input.metadata,
              description: 'Vault Withdrawal',
            },
            queryRunner,
          );
          if (!credit.success) {
            throw new BadRequestException(credit.error || 'Vault withdraw failed');
          }

          const vh = new BalanceVaultHistoryEntity();
          vh.operationId = input.operationId;
          vh.userId = userId;
          vh.asset = input.asset;
          vh.direction = VaultDirectionEnum.WITHDRAW;
          vh.amount = input.amount.toString();
          vh.previousVaultBalance = prev.toString();
          vh.metadata = input.metadata as Record<string, any> | undefined;
          await queryRunner.manager.save(vh);

          await queryRunner.commitTransaction();
          return {
            asset: input.asset,
            walletBalance: credit.balance,
            vaultBalance: this.formatBalance(nb.toString()),
          };
        } catch (e) {
          await queryRunner.rollbackTransaction();
          throw e;
        } finally {
          await queryRunner.release();
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for vault withdraw', {
          userId,
          asset: input.asset,
          amount: input.amount.toString(),
          lockResource,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  private async updateWalletAndHistoryAtomic(
    queryRunner: QueryRunner,
    dto: UpdateBalanceDto,
  ): Promise<BalanceWalletEntity> {
    const walletRepo = queryRunner.manager.getRepository(BalanceWalletEntity);

    // Calculate amount to add/subtract based on operation
    let balanceChange = new BigNumber(dto.amount.toString()).abs();

    // Operations that decrease balance
    if (
      dto.operation === BalanceOperationEnum.BET ||
      dto.operation === BalanceOperationEnum.WITHDRAW ||
      dto.operation === BalanceOperationEnum.BUYIN ||
      dto.operation === BalanceOperationEnum.WIN_CANCEL ||
      dto.operation === BalanceOperationEnum.CORRECTION_DEBIT ||
      dto.operation === BalanceOperationEnum.CORRECTION_BUYIN ||
      dto.operation === BalanceOperationEnum.VAULT_DEPOSIT ||
      dto.operation === BalanceOperationEnum.TIP_SEND ||
      dto.operation === BalanceOperationEnum.RACE_CREATION
    ) {
      balanceChange = balanceChange.negated();
    }
    // All other operations increase balance

    const canBeNegative = [
      BalanceOperationEnum.CORRECTION_DEBIT,
      BalanceOperationEnum.CORRECTION_BUYIN,
      BalanceOperationEnum.WIN_CANCEL,
    ].includes(dto.operation);

    // Special handling for demo bets (amount = 0)
    // Allow zero-value bets regardless of balance to support demo mode
    const isDemoBet = dto.operation === BalanceOperationEnum.BET && dto.amount.eq(0);

    // First try to update existing wallet
    const updateResult = await queryRunner.manager.query(
      `
      UPDATE balance.wallets
      SET balance = balance::numeric + $1::numeric,
          "updatedAt" = NOW()
      WHERE "userId" = $2 AND asset = $3
        ${canBeNegative ? '' : ' AND (balance::numeric + $1::numeric) >= 0 '}
        AND (balance::numeric + $1::numeric) <= 999999999999
      RETURNING *, balance::text as balance_text
    `,
      [balanceChange.toString(), dto.userId, dto.asset],
    );

    let updatedWallet;

    // Check if any rows were actually updated - TypeORM returns [[],0] when no rows updated
    if (updateResult[0].length === 0) {
      // Try to create wallet if it doesn't exist or insufficient balance
      let wallet = await walletRepo.findOne({
        where: { userId: dto.userId, asset: dto.asset },
      });

      if (!wallet) {
        // Create new wallet - for operations that increase balance, set initial balance to operation amount
        const existingCount = await walletRepo.count({ where: { userId: dto.userId } });

        // For operations that decrease balance (like BET), start with 0 and fail
        // EXCEPT for demo bets (amount = 0) which are always allowed
        if (balanceChange.isNegative() && !canBeNegative && !isDemoBet) {
          throw new InsufficientBalanceError();
        }

        // For operations that increase balance (like DEPOSIT), set initial balance to the amount
        const initialBalance = dto.amount.toString();

        wallet = walletRepo.create({
          userId: dto.userId,
          asset: dto.asset,
          balance: initialBalance,
          isPrimary: existingCount === 0,
        });

        wallet = await walletRepo.save(wallet);

        // Set updatedWallet with proper format for new wallet
        updatedWallet = {
          ...wallet,
          balance_text: wallet.balance,
        };
      } else {
        // Wallet exists but operation would result in negative balance or exceed limits
        throw new InsufficientBalanceError();
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
        updateResultLength: updateResult.length,
        updatedWalletKeys: updatedWallet ? Object.keys(updatedWallet) : 'null',
        firstResultKeys: updateResult[0] ? Object.keys(updateResult[0]) : 'null',
        rawResults: updateResult.map((r, i) => ({ index: i, keys: r ? Object.keys(r) : 'null' })),
      });
      throw new InternalServerErrorException('Failed to update wallet balance');
    }

    // Get previous balance for history
    const previousBalance = new BigNumber(updatedWallet.balance_text)
      .minus(balanceChange)
      .toString();

    // Calculate rate and convert amounts to cents
    const rate = new BigNumber(this.cryptoConverter.getRate(dto.asset));
    const amountCents = this.cryptoConverter.toCents(dto.amount.toString(), dto.asset);

    // Create history record
    const history = new BalanceHistoryEntity();
    history.operationId = dto.operationId;
    history.operation = dto.operation;
    history.amount = dto.amount.toString();
    history.asset = dto.asset;
    history.userId = dto.userId;
    history.rate = rate.toString();
    history.amountCents = amountCents;
    history.previousBalance = previousBalance;
    history.metadata = dto.metadata;
    history.description = dto.description;
    history.status = BalanceHistoryStatusEnum.CONFIRMED;
    // House edge should be recorded ONLY for BET operations
    if (dto.operation === BalanceOperationEnum.BET) {
      history.houseEdge = (dto.houseEdge ?? 1).toString();
    }
    await queryRunner.manager.save(history);

    // Return wallet entity format
    const walletEntity = new BalanceWalletEntity();
    Object.assign(walletEntity, updatedWallet);
    walletEntity.balance = updatedWallet.balance_text; // Use text version for entity

    return walletEntity;
  }

  private async updateStatisticsAtomic(
    queryRunner: QueryRunner,
    dto: UpdateBalanceDto,
  ): Promise<void> {
    const amountCents = new BigNumber(
      this.cryptoConverter.toCents(dto.amount.toString(), dto.asset),
    );

    let updateQuery = '';
    const updateParams: any[] = [dto.userId];

    switch (dto.operation) {
      case BalanceOperationEnum.DEPOSIT:
      case BalanceOperationEnum.PAYOUT:
        updateQuery = `
          UPDATE balance.balance_statistics 
          SET deps = deps::numeric + $2::numeric
          WHERE "userId" = $1
        `;
        updateParams.push(amountCents.toString());
        break;

      case BalanceOperationEnum.WITHDRAW:
      case BalanceOperationEnum.BUYIN:
        updateQuery = `
          UPDATE balance.balance_statistics 
          SET withs = withs::numeric + $2::numeric
          WHERE "userId" = $1
        `;
        updateParams.push(amountCents.toString());
        break;

      case BalanceOperationEnum.BET:
        updateQuery = `
          UPDATE balance.balance_statistics 
          SET bets = bets::numeric + $2::numeric,
              "betCount" = COALESCE("betCount", 0) + 1
          WHERE "userId" = $1
        `;
        updateParams.push(amountCents.toString());
        break;

      case BalanceOperationEnum.WIN:
        if (parseFloat(dto.amount.toString()) > 0) {
          updateQuery = `
            UPDATE balance.balance_statistics 
            SET wins = wins::numeric + $2::numeric,
                "winCount" = COALESCE("winCount", 0) + 1
            WHERE "userId" = $1
          `;
        } else {
          updateQuery = `
            UPDATE balance.balance_statistics 
            SET wins = wins::numeric + $2::numeric
            WHERE "userId" = $1
          `;
        }
        updateParams.push(amountCents.toString());
        break;

      case BalanceOperationEnum.REFUND:
        updateQuery = `
          UPDATE balance.balance_statistics 
          SET refunds = refunds::numeric + $2::numeric
          WHERE "userId" = $1
        `;
        updateParams.push(amountCents.toString());
        break;
    }

    if (updateQuery) {
      const result = await queryRunner.manager.query(updateQuery, updateParams);

      // If no rows updated, create statistics record
      if (result[1] === 0) {
        const statistic = new BalanceStatisticEntity();
        statistic.userId = dto.userId;
        statistic.deps = '0';
        statistic.withs = '0';
        statistic.bets = '0';
        statistic.wins = '0';
        statistic.refunds = '0';

        // Set the appropriate field for this operation
        switch (dto.operation) {
          case BalanceOperationEnum.DEPOSIT:
          case BalanceOperationEnum.PAYOUT:
            statistic.deps = amountCents.toString();
            break;
          case BalanceOperationEnum.WITHDRAW:
          case BalanceOperationEnum.BUYIN:
            statistic.withs = amountCents.toString();
            break;
          case BalanceOperationEnum.BET:
            statistic.bets = amountCents.toString();
            statistic.betCount = 1;
            break;
          case BalanceOperationEnum.WIN:
            statistic.wins = amountCents.toString();
            if (parseFloat(dto.amount.toString()) > 0) {
              statistic.winCount = 1;
            }
            break;
          case BalanceOperationEnum.REFUND:
            statistic.refunds = amountCents.toString();
            break;
        }

        await queryRunner.manager.save(statistic);
      }
    }
  }

  async getPrimaryWallet(userId: string): Promise<BalanceWalletEntity | null> {
    const repo = this.dataSource.getRepository(BalanceWalletEntity);
    return repo.findOne({ where: { userId, isPrimary: true } });
  }

  /**
   * Check if the user has reached their loss limit
   * @param userId User ID
   * @param betAmount Bet amount
   * @param asset Asset type
   */
  async checkLossLimits(userId: string, betAmount: BigNumber, asset: AssetTypeEnum): Promise<void> {
    // Get active loss limits for the user
    const activeSelfExclusions = await this.selfExclusionService.getActiveSelfExclusions(userId);
    const lossLimits = activeSelfExclusions.filter(
      (exclusion) => exclusion.type === SelfExclusionTypeEnum.LOSS_LIMIT,
    );

    if (lossLimits.length === 0) {
      return; // No loss limits set
    }

    // Calculate current losses for each period
    for (const limit of lossLimits) {
      if (!limit.period || !limit.limitAmount) {
        continue; // Skip if period or limitAmount is not set
      }

      // Pass the platform type from the limit to calculateUserLosses
      const losses = await this.calculateUserLosses(
        userId,
        limit.period,
        asset,
        limit.platformType,
      );
      const lossesBN = new BigNumber(losses);
      const newLosses = lossesBN.plus(betAmount);
      const limitAmountBN = new BigNumber(limit.limitAmount);

      // If the new bet would exceed the loss limit, throw an error
      if (newLosses.isGreaterThan(limitAmountBN)) {
        throw new ForbiddenException(
          `Loss limit of ${limit.limitAmount} ${asset} for ${limit.period.toLowerCase()} period has been reached`,
        );
      }
    }
  }

  /**
   * Check wager limits before allowing a bet
   * @param userId User ID
   * @param betAmount Bet amount in dollars
   * @param platformType Platform type (CASINO, SPORTS, or PLATFORM)
   */
  async checkWagerLimits(
    userId: string,
    betAmount: BigNumber,
    platformType: PlatformTypeEnum,
  ): Promise<void> {
    // Get active wager limits for the user
    const activeSelfExclusions = await this.selfExclusionService.getActiveSelfExclusions(userId);
    const wagerLimits = activeSelfExclusions.filter(
      (exclusion) => exclusion.type === SelfExclusionTypeEnum.WAGER_LIMIT,
    );

    if (wagerLimits.length === 0) {
      return; // No wager limits set
    }

    // Check each active wager limit
    for (const limit of wagerLimits) {
      if (!limit.period || !limit.limitAmount) {
        continue; // Skip if period or limitAmount is not set
      }

      // Skip if limit is for different platform (SPORTS vs CASINO)
      if (
        limit.platformType &&
        limit.platformType !== platformType &&
        limit.platformType !== PlatformTypeEnum.PLATFORM
      ) {
        continue;
      }

      // Get period start/end dates based on limit.period
      const { startDate, endDate } = this.getPeriodDates(limit.period);

      // Get total wagers for this period (in cents)
      const totalWagersCents = await this.dailyGamblingStatsService.getTotalWagersForPeriod(
        userId,
        startDate,
        endDate,
        limit.platformType,
      );

      // Convert amounts to cents for comparison
      const limitAmountCents = Math.floor(Number(limit.limitAmount) * 100);
      const betAmountCents = Math.floor(betAmount.toNumber() * 100);

      // Check if adding this bet would exceed limit
      if (totalWagersCents + betAmountCents > limitAmountCents) {
        const remainingCents = Math.max(0, limitAmountCents - totalWagersCents);
        const remainingDollars = (remainingCents / 100).toFixed(2);
        const periodName = this.getPeriodName(limit.period);

        throw new ForbiddenException(
          `Wager limit exceeded. Your ${periodName} wager limit is $${Number(limit.limitAmount).toFixed(2)}. ` +
            `You have $${remainingDollars} remaining.`,
        );
      }
    }
  }

  /**
   * Get period dates for limit checking
   */
  private getPeriodDates(period: LimitPeriodEnum): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate: Date;
    const endDate = new Date(now);

    switch (period) {
      case LimitPeriodEnum.DAILY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case LimitPeriodEnum.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case LimitPeriodEnum.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case LimitPeriodEnum.SESSION:
        // For session, use the last 24 hours
        startDate = new Date(now);
        startDate.setHours(now.getHours() - 24);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return { startDate, endDate };
  }

  /**
   * Get human-readable period name
   */
  private getPeriodName(period: LimitPeriodEnum): string {
    switch (period) {
      case LimitPeriodEnum.DAILY:
        return 'daily';
      case LimitPeriodEnum.WEEKLY:
        return 'weekly';
      case LimitPeriodEnum.MONTHLY:
        return 'monthly';
      case LimitPeriodEnum.SESSION:
        return 'session';
      default:
        return period.toLowerCase();
    }
  }

  /**
   * Calculate user losses for a specific period
   * @param userId User ID
   * @param period Period (DAILY, WEEKLY, MONTHLY, SESSION)
   * @param asset Asset type
   * @param platformType Optional platform type to filter by
   * @returns Total losses for the period
   */
  async calculateUserLosses(
    userId: string,
    period: LimitPeriodEnum,
    asset: AssetTypeEnum,
    platformType?: PlatformTypeEnum,
  ): Promise<string> {
    const now = new Date();
    let startDate: Date;
    const endDate = new Date(now);

    // Calculate start date based on period
    switch (period) {
      case LimitPeriodEnum.DAILY:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case LimitPeriodEnum.WEEKLY:
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        break;
      case LimitPeriodEnum.MONTHLY:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case LimitPeriodEnum.SESSION:
        // For session, we'll use the last 24 hours as a simple definition
        startDate = new Date(now);
        startDate.setHours(now.getHours() - 24);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Use the daily gambling stats service to get the total loss amount
    // This uses the aggregated data from the daily_gambling_stats table
    // which is more efficient than querying the balance history directly
    const totalLoss = await this.dailyGamblingStatsService.getTotalLossAmount(
      userId,
      startDate,
      endDate,
      platformType,
    );

    // Convert to string and return
    return totalLoss.toString();
  }

  /**
   * Update balance by fiat amount: converts fiat to crypto using primary wallet asset and reuses updateBalance
   */
  async updateFiatBalance(dto: UpdateFiatBalanceDto): Promise<{
    success: boolean;
    balance: string;
    error?: string;
    status: BalanceOperationResultEnum;
    asset: AssetTypeEnum;
  }> {
    const primaryWallet = await this.getPrimaryWallet(dto.userId);
    if (!primaryWallet) {
      throw new BadRequestException(ERROR_MESSAGES.PAYMENTS.WALLET_NOT_FOUND);
    }

    // Parse amount as cents and convert to crypto with NaN protection
    const cryptoAmountString = this.cryptoConverter.fromCents(dto.amount, primaryWallet.asset);
    const cryptoAmount = parseFloat(cryptoAmountString);

    if (isNaN(cryptoAmount) || !isFinite(cryptoAmount)) {
      this.logger.error(
        `Invalid crypto amount conversion: ${cryptoAmountString} from ${dto.amount} cents`,
      );
      throw new BadRequestException('Invalid amount conversion');
    }

    const cryptoDto: UpdateBalanceDto = {
      operation: dto.operation,
      operationId: dto.operationId,
      userId: dto.userId,
      amount: new BigNumber(cryptoAmount),
      asset: primaryWallet.asset,
      description: dto.description,
      metadata: dto.metadata,
      houseEdge: dto.houseEdge,
    };
    const result = await this.updateBalance(cryptoDto);

    return {
      success: result.success,
      balance: this.cryptoConverter.toCents(result.balance, primaryWallet.asset),
      error: result.error,
      status: result.status,
      asset: primaryWallet.asset,
    };
  }

  /**
   * Get primary wallet balance in fiat (cents)
   */
  async getFiatBalance(userId: string): Promise<string> {
    const repo = this.dataSource.getRepository(BalanceWalletEntity);
    const primaryWallet = await repo.findOne({ where: { userId, isPrimary: true } });
    if (!primaryWallet) {
      throw new BadRequestException(ERROR_MESSAGES.PAYMENTS.WALLET_NOT_FOUND);
    }
    // Convert crypto balance to cents
    return this.cryptoConverter.toCents(primaryWallet.balance, primaryWallet.asset);
  }

  async getBalanceStatisticsForUsers(userIds: string[]): Promise<BalanceStatisticEntity[]> {
    if (userIds.length === 0) {
      return [];
    }

    const stats = await this.dataSource
      .getRepository(BalanceStatisticEntity)
      .createQueryBuilder('stat')
      .where('stat.userId IN (:...userIds)', { userIds })
      .getMany();

    // Ensure all requested users are included, even if they have no statistics
    const statsMap = new Map(stats.map((s) => [s.userId, s]));

    return userIds.map((userId) => {
      const stat = statsMap.get(userId);
      if (stat) {
        return stat;
      }

      // Return default statistics for users without records
      const defaultStat = new BalanceStatisticEntity();
      defaultStat.userId = userId;
      defaultStat.deps = '0';
      defaultStat.withs = '0';
      defaultStat.bets = '0';
      defaultStat.wins = '0';
      defaultStat.refunds = '0';
      defaultStat.betCount = 0;
      defaultStat.winCount = 0;
      return defaultStat;
    });
  }

  async getUsersBalanceReport(
    userIds: string[],
    fromDate: Date,
    toDate: Date,
  ): Promise<
    Array<{
      userId: string;
      totalWager: string;
      totalWins: string;
      netWager: string;
      totalDeposits: string;
      totalWithdrawals: string;
      transactionCount: number;
    }>
  > {
    if (userIds.length === 0) {
      return [];
    }

    if (userIds.length > 100) {
      throw new Error('Cannot process more than 100 users at once');
    }

    const reports = (await this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .select('history.userId', 'userId')
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS numeric) ELSE 0 END), 0)',
        'totalWager',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :win THEN CAST(history.amountCents AS numeric) ELSE 0 END), 0)',
        'totalWins',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :bet2 THEN CAST(history.amountCents AS numeric) ELSE 0 END) - SUM(CASE WHEN history.operation = :refund THEN CAST(history.amountCents AS numeric) ELSE 0 END), 0)',
        'netWager',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :deposit THEN CAST(history.amountCents AS numeric) ELSE 0 END), 0)',
        'totalDeposits',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :withdraw THEN CAST(history.amountCents AS numeric) ELSE 0 END), 0)',
        'totalWithdrawals',
      )
      .addSelect('COUNT(*)', 'transactionCount')
      .where('history.userId IN (:...userIds)', { userIds })
      .andWhere('history.createdAt >= :fromDate', { fromDate })
      .andWhere('history.createdAt <= :toDate', { toDate })
      .setParameters({
        bet: BalanceOperationEnum.BET,
        bet2: BalanceOperationEnum.BET,
        win: BalanceOperationEnum.WIN,
        refund: BalanceOperationEnum.REFUND,
        deposit: BalanceOperationEnum.DEPOSIT,
        withdraw: BalanceOperationEnum.WITHDRAW,
      })
      .groupBy('history.userId')
      .getRawMany<{
        userId: string;
        totalWager: string;
        totalWins: string;
        netWager: string;
        totalDeposits: string;
        totalWithdrawals: string;
        transactionCount: string;
      }>()) as {
      userId: string;
      totalWager: string;
      totalWins: string;
      netWager: string;
      totalDeposits: string;
      totalWithdrawals: string;
      transactionCount: string;
    }[];

    // Ensure all requested users are included, even if they have no transactions
    const reportMap = new Map(reports.map((r) => [r.userId, r]));

    return userIds.map((userId) => {
      const report = reportMap.get(userId);
      const transactionCount = report ? parseInt(report.transactionCount, 10) : 0;

      return {
        userId,
        totalWager: report?.totalWager || '0',
        totalWins: report?.totalWins || '0',
        netWager: report?.netWager || '0',
        totalDeposits: report?.totalDeposits || '0',
        totalWithdrawals: report?.totalWithdrawals || '0',
        transactionCount: isNaN(transactionCount) ? 0 : transactionCount,
      };
    });
  }

  /**
   * Get daily rakeback statistics for multiple users (for bonus calculations)
   * Returns data in cents for bonus calculations
   */
  async getDailyRakebackStats(
    userIds: string[],
    dayStart: Date,
    dayEnd: Date,
  ): Promise<
    Array<{
      userId: string;
      bets: string; // Total bets in cents
      wins: string; // Total wins in cents
      refunds: string; // Total refunds in cents
      effectiveEdgeCents: string; // Total effective rakeback in cents
    }>
  > {
    if (userIds.length === 0) {
      return [];
    }

    if (userIds.length > 1000) {
      throw new Error('Cannot process more than 1000 users at once');
    }

    const stats = await this.dataSource
      .getRepository(BalanceHistoryEntity)
      .createQueryBuilder('history')
      .select('history.userId', 'userId')
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END), 0)',
        'bets',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :win THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END), 0)',
        'wins',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :refund THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END), 0)',
        'refunds',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) * (CAST(history.houseEdge AS DECIMAL) / 100) ELSE 0 END), 0)',
        'effectiveEdgeCents',
      )
      .where('history.userId IN (:...userIds)', { userIds })
      .andWhere('history.createdAt >= :dayStart', { dayStart })
      .andWhere('history.createdAt <= :dayEnd', { dayEnd })
      .setParameters({
        bet: BalanceOperationEnum.BET,
        win: BalanceOperationEnum.WIN,
        refund: BalanceOperationEnum.REFUND,
      })
      .groupBy('history.userId')
      .getRawMany<{
        userId: string;
        bets: string;
        wins: string;
        refunds: string;
        effectiveEdgeCents: string;
      }>();

    // Ensure all requested users are included, even if they have no activity
    const statsMap = new Map(stats.map((s) => [s.userId, s]));

    return userIds.map((userId) => {
      const stat = statsMap.get(userId);
      return {
        userId,
        bets: stat?.bets || '0',
        wins: stat?.wins || '0',
        refunds: stat?.refunds || '0',
        effectiveEdgeCents: stat?.effectiveEdgeCents || '0',
      };
    });
  }

  async tip(fromUserId: string, input: CreateTipInput): Promise<TipResultDto> {
    if (!this.usersService) {
      throw new InternalServerErrorException('UsersService not available');
    }
    // Resolve sender and receiver, and do basic validation
    const [sender, recipient] = await Promise.all([
      this.usersService.findById(fromUserId),
      this.usersService.findByEmailOrUsername(input.toUsername),
    ]);

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    if (!recipient) {
      throw new NotFoundException('User not found');
    }
    if (recipient.id === sender.id) {
      throw new BadRequestException('Cannot tip yourself');
    }

    // Lock resource key: balance:tip:{fromUserId}:{toUserId} for multi-user operations
    // Sort user IDs to prevent deadlock when users tip each other simultaneously
    const userIds = [fromUserId, recipient.id].sort();
    const lockResource = `balance:tip:${userIds[0]}:${userIds[1]}`;
    const lockTTL = LockTTL.COMPLEX_OPERATION; // Multi-user operation with multiple balance updates

    try {
      return await this.distributedLockService.withLock(lockResource, lockTTL, async () => {
        this.logger.debug(`Acquired distributed lock for tip operation`, {
          fromUserId,
          toUserId: recipient.id,
          asset: input.asset,
          amount: input.amount.toString(),
          lockResource,
        });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const sendOpId = randomUUID();
          const receiveOpId = randomUUID();

          // Sender: TIP_SEND (debit)
          const debit = await this.updateBalance(
            {
              operation: BalanceOperationEnum.TIP_SEND,
              operationId: sendOpId,
              userId: fromUserId,
              amount: input.amount,
              asset: input.asset,
              metadata: {
                fromUserId: sender.id,
                fromUsername: sender.username,
                toUserId: recipient.id,
                toUsername: recipient.username,
                message: input.message,
                publicTip: input.publicTip,
                // twoFactor: input.twoFactor, // TODO: verify 2FA
              },
            },
            queryRunner,
          );

          if (!debit.success) {
            throw new BadRequestException(debit.error || 'Tip debit failed');
          }

          // Receiver: TIP_RECEIVE (credit)
          const credit = await this.updateBalance(
            {
              operation: BalanceOperationEnum.TIP_RECEIVE,
              operationId: receiveOpId,
              userId: recipient.id,
              amount: input.amount,
              asset: input.asset,
              metadata: {
                fromUserId: sender.id,
                fromUsername: sender.username,
                toUserId: recipient.id,
                toUsername: recipient.username,
                message: input.message,
                publicTip: input.publicTip,
              },
            },
            queryRunner,
          );

          if (!credit.success) {
            throw new BadRequestException(credit.error || 'Tip credit failed');
          }

          await queryRunner.commitTransaction();

          if (input.publicTip) {
            this.logger.log('Emitting balance.tip event', {
              senderId: sender.id,
              recipientId: recipient.id,
              asset: input.asset,
              amount: input.amount.toString(),
              publicTip: input.publicTip,
            });

            // Emit tip notification event for chat integration
            // Note: Error is caught and logged but not re-thrown to ensure
            // tip transaction succeeds even if chat notification fails.
            // This prevents chat service issues from blocking financial operations.
            // Users will still see the tip reflected in their balances and receive
            // WebSocket balance updates via the standard balance notification system.
            //
            // Race condition protection: Using setImmediate() ensures the transaction
            // is fully committed and visible to other database connections before
            // the event is emitted. This prevents chat service from querying data
            // that isn't yet visible due to transaction isolation.
            setImmediate(() => {
              this.eventEmitter
                .emitAsync('balance.tip', {
                  sender,
                  recipient,
                  asset: input.asset,
                  amount: input.amount,
                })
                .catch((error) => {
                  // Log error for monitoring/alerting but don't fail the tip
                  this.logger.error(
                    'Failed to emit balance.tip event - tip transaction succeeded but chat notification failed',
                    {
                      error: error instanceof Error ? error.message : String(error),
                      senderId: sender.id,
                      recipientId: recipient.id,
                      asset: input.asset,
                      amount: input.amount.toString(),
                    },
                  );
                });
            });
          } else {
            this.logger.debug('Not emitting balance.tip event because publicTip is false');
          }

          return {
            sendOperationId: sendOpId,
            receiveOperationId: receiveOpId,
            senderBalance: debit.balance,
            receiverBalance: credit.balance,
          };
        } catch (e) {
          await queryRunner.rollbackTransaction();
          throw e;
        } finally {
          await queryRunner.release();
        }
      });
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for tip operation', {
          fromUserId,
          toUserId: recipient.id,
          asset: input.asset,
          amount: input.amount.toString(),
          lockResource,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }
}
