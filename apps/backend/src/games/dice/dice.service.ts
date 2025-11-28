import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  DiceBetEntity,
  DiceBetStatus,
  DiceBetType,
  GameType,
  GameTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { ProvablyFairService } from '../services/provably-fair.service';
import { UserBetService } from '../services/user-bet.service';
import { DiceBetResponseDto } from './dto/dice-bet-response.dto';
import { PlaceDiceBetDto } from './dto/place-dice-bet.dto';

// Extended UserEntity interface for typing
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

@Injectable()
export class DiceService {
  private readonly logger = new Logger(DiceService.name);

  // In-memory cache for game parameters to avoid repeated calculations
  private readonly gameParamsCache = new Map<
    string,
    {
      targetNumber: number;
      multiplier: number;
      winChance: number;
    }
  >();
  private readonly MAX_CACHE_SIZE = 1000; // Limit cache size to prevent memory leaks

  constructor(
    @InjectRepository(DiceBetEntity)
    private readonly diceBetRepository: Repository<DiceBetEntity>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly userBetService: UserBetService,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly gameConfigService: GameConfigService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async placeBet(user: UserEntity, dto: PlaceDiceBetDto): Promise<DiceBetResponseDto> {
    // Generate gameSessionId if not provided for lock key
    const gameSessionId = dto.gameSessionId || randomUUID();

    // Acquire distributed lock for user bet to prevent race conditions across multiple instances
    const lockKey = LockKeyBuilder.gameDice(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          // Get primary asset from user object (set by JwtStrategy guard)
          const userWithAsset = user as UserWithPrimaryAsset;
          const primaryAsset = userWithAsset.primaryAsset;

          if (!primaryAsset) {
            throw new BadRequestException('No primary asset found for user');
          }

          // Validate bet parameters including dynamic bet limits
          await this.validateBetParameters(dto, primaryAsset, user);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            this.logger.log(`User ${user.id} placing dice bet`, {
              userId: user.id,
              amount: dto.betAmount,
              asset: primaryAsset,
              betType: dto.betType,
              targetNumber: dto.targetNumber,
              multiplier: dto.multiplier,
            });

            // Calculate game parameters
            const gameParams = this.calculateGameParameters(dto);

            // Generate provably fair outcome using centralized service
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.DICE,
              dto.betAmount,
            );

            // Extract seeds and nonce from outcome
            const { serverSeed, clientSeed, nonce: nonceStr } = gameOutcome;
            const nonce = parseInt(nonceStr, 10);
            const serverSeedHash = this.hashServerSeed(serverSeed);

            // Use centralized fiat preservation service for validation and data extraction
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              dto.betAmount,
              primaryAsset,
            );

            // Create bet record first to get bet ID
            const bet = this.diceBetRepository.create({
              userId: user.id,
              gameSessionId,
              betAmount: dto.betAmount,
              asset: primaryAsset,
              betType: dto.betType,
              targetNumber: gameParams.targetNumber.toString(),
              multiplier: gameParams.multiplier.toString(),
              winChance: gameParams.winChance.toString(),
              status: DiceBetStatus.PENDING,
              clientSeed: clientSeed,
              serverSeed: serverSeed,
              serverSeedHash: serverSeedHash,
              nonce: nonce,
              // Fiat preservation fields
              originalFiatAmount: fiatData.originalFiatAmount,
              originalFiatCurrency: fiatData.originalFiatCurrency,
              fiatToUsdRate: fiatData.fiatToUsdRate,
            });

            await queryRunner.manager.save(bet);

            const rollResult = gameOutcome.value;

            // Determine if bet won or lost
            const isWin = this.determineBetResult(rollResult, gameParams.targetNumber, dto.betType);

            // Update bet with result
            bet.rollResult = rollResult.toFixed(2);
            bet.status = isWin ? DiceBetStatus.WON : DiceBetStatus.LOST;

            let finalPayout = '0';
            let balanceResult;

            if (isWin) {
              const winAmount = new BigNumber(dto.betAmount).multipliedBy(gameParams.multiplier);
              // Round to 8 dp using casino-safe policy: ROUND_DOWN
              const roundedWinAmount = winAmount.decimalPlaces(8, BigNumber.ROUND_DOWN);

              // Use batch operation for BET+WIN (single transaction, better performance)
              const operationId = randomUUID();
              const winOperationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                [
                  {
                    operation: BalanceOperationEnum.BET,
                    operationId,
                    userId: user.id,
                    amount: new BigNumber(dto.betAmount),
                    asset: primaryAsset,
                    description: 'Dice bet',
                    metadata: { gameSessionId, betId: bet.id },
                    houseEdge: this.houseEdgeService.getEdge('dice'),
                  },
                  {
                    operation: BalanceOperationEnum.WIN,
                    operationId: winOperationId,
                    userId: user.id,
                    amount: roundedWinAmount,
                    asset: primaryAsset,
                    description: 'Dice win',
                    metadata: { gameSessionId, betId: bet.id },
                  },
                ],
                queryRunner,
              );

              if (!balanceResult.success) {
                this.logger.error(`Failed to process BET+WIN for bet ${bet.id}`, {
                  betId: bet.id,
                  userId: user.id,
                  error: balanceResult.error,
                  betAmount: dto.betAmount,
                  winAmount: roundedWinAmount.toString(),
                });
                throw new BadRequestException(
                  balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
                );
              }

              bet.winAmount = roundedWinAmount.toString();
              finalPayout = roundedWinAmount.toString();

              this.logger.log(`Dice bet won (batch processed)`, {
                betId: bet.id,
                userId: user.id,
                rollResult: rollResult,
                winAmount: roundedWinAmount.toString(),
              });
            } else {
              // Loss: only BET operation (deduct bet amount)
              const operationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                {
                  operation: BalanceOperationEnum.BET,
                  operationId,
                  userId: user.id,
                  amount: new BigNumber(dto.betAmount),
                  asset: primaryAsset,
                  description: 'Dice bet',
                  metadata: { gameSessionId, betId: bet.id },
                  houseEdge: this.houseEdgeService.getEdge('dice'),
                },
                queryRunner,
              );

              if (!balanceResult.success) {
                throw new BadRequestException(
                  balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
                );
              }

              bet.winAmount = '0';
              this.logger.log(`Dice bet lost`, {
                betId: bet.id,
                userId: user.id,
                rollResult: rollResult,
              });
            }

            await queryRunner.manager.save(bet);

            // Set user relation for response
            bet.user = user;

            await queryRunner.commitTransaction();

            // Save to user_bets table asynchronously after transaction commit
            // Calculate actual multiplier and payout for bet feed display
            let actualMultiplier: string;
            let betFeedPayout: string;

            if (isWin) {
              // Win: show actual multiplier and total payout amount
              const actualMultiplierValue = parseFloat(finalPayout) / parseFloat(dto.betAmount);
              actualMultiplier = actualMultiplierValue.toFixed(4);
              betFeedPayout = finalPayout; // Show total payout, not net profit
            } else {
              // Loss: show 0.00x multiplier and 0.00 payout (player receives nothing)
              // Payout represents what the player actually receives, not net profit/loss
              actualMultiplier = '0.0000';
              betFeedPayout = '0.00000000';
            }

            // Create user bet record asynchronously (don't await to avoid blocking response)
            setImmediate(() => {
              void this.userBetService
                .createUserBet({
                  game: GameTypeEnum.DICE,
                  betId: bet.id,
                  userId: user.id,
                  betAmount: dto.betAmount,
                  asset: primaryAsset,
                  multiplier: actualMultiplier, // Use actual multiplier for bet feed
                  payout: betFeedPayout, // Use calculated bet feed payout
                  // Fiat currency fields for preserving exact user input
                  originalFiatAmount: fiatData.originalFiatAmount,
                  originalFiatCurrency: fiatData.originalFiatCurrency,
                  fiatToUsdRate: fiatData.fiatToUsdRate,
                })
                .catch((error) => {
                  this.logger.error(`Failed to create user bet record for bet ${bet.id}`, {
                    betId: bet.id,
                    userId: user.id,
                    error: error.message,
                  });
                });
            });

            // Return response
            return await this.mapToResponseDto(bet);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error processing dice bet for user ${user.id}:`, error);

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to process dice bet');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for dice bet', {
          userId: user.id,
          betAmount: dto.betAmount,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async getBetHistory(userId: string, limit: number = 50): Promise<DiceBetResponseDto[]> {
    // Optimized query with selective fields for better performance
    const bets = await this.diceBetRepository
      .createQueryBuilder('bet')
      .leftJoinAndSelect('bet.user', 'user')
      .select([
        'bet.id',
        'bet.userId',
        'bet.betAmount',
        'bet.asset',
        'bet.betType',
        'bet.targetNumber',
        'bet.multiplier',
        'bet.winChance',
        'bet.rollResult',
        'bet.status',
        'bet.winAmount',
        'bet.createdAt',
        'user.id',
        'user.username',
        'user.displayName',
      ])
      .where('bet.userId = :userId', { userId })
      .orderBy('bet.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return await Promise.all(bets.map((bet) => this.mapToResponseDto(bet)));
  }

  async getBetById(betId: string, requestingUserId?: string): Promise<DiceBetResponseDto | null> {
    const bet = await this.diceBetRepository.findOne({
      where: { id: betId },
      relations: ['user'],
    });

    if (!bet) {
      return null;
    }

    // Phase 1: Check if requesting user is the bet owner
    const isOwner = requestingUserId === bet.userId;
    return await this.mapToResponseDto(bet, isOwner);
  }

  /**
   * Validate bet amounts using USD-based limits with real-time conversion
   */
  private async validateBetAmount(
    betAmount: string,
    asset: AssetTypeEnum,
    user?: UserEntity,
  ): Promise<void> {
    try {
      const validation = user?.currentCurrency
        ? await this.gameConfigService.validateBetAmount(
            GameType.DICE,
            betAmount,
            asset,
            user.currentCurrency,
          )
        : await this.gameConfigService.validateBetAmount(GameType.DICE, betAmount, asset);

      if (!validation.isValid) {
        throw new BadRequestException(
          validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
        );
      }

      this.logger.debug(
        `Bet amount ${betAmount} ${asset} validated (${validation.usdAmount?.toFixed(2)} USD)`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.warn('Failed to validate bet amount with USD conversion, using fallback:', error);
      // Fallback validation with hardcoded limits
      const betAmountBN = new BigNumber(betAmount);
      if (betAmountBN.isLessThan('0.00000001')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
      }
      if (betAmountBN.isGreaterThan('100')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_LARGE);
      }
    }
  }

  private async validateBetParameters(
    dto: PlaceDiceBetDto,
    asset: AssetTypeEnum,
    user?: UserEntity,
  ): Promise<void> {
    // Validate bet amount using dynamic configuration
    await this.validateBetAmount(dto.betAmount, asset, user);

    // Ensure either targetNumber or multiplier is provided, but not both
    if (dto.targetNumber !== undefined && dto.multiplier !== undefined) {
      throw new BadRequestException('Provide either targetNumber or multiplier, not both');
    }

    if (dto.targetNumber === undefined && dto.multiplier === undefined) {
      throw new BadRequestException('Either targetNumber or multiplier must be provided');
    }

    // Target number validation aligned to support 9900x range
    if (dto.targetNumber !== undefined) {
      if (dto.betType === DiceBetType.ROLL_OVER && dto.targetNumber > 99.98) {
        throw new BadRequestException('Roll over target too high (max 99.98)');
      }
      if (dto.betType === DiceBetType.ROLL_UNDER && dto.targetNumber < 0.01) {
        throw new BadRequestException('Roll under target too low (min 0.01)');
      }
    }
  }

  private calculateGameParameters(dto: PlaceDiceBetDto): {
    targetNumber: number;
    multiplier: number;
    winChance: number;
  } {
    // Create cache key based on input parameters
    const cacheKey =
      dto.targetNumber !== undefined
        ? `${dto.betType}-target-${dto.targetNumber}`
        : `${dto.betType}-mult-${dto.multiplier}`;

    // Check cache first
    if (this.gameParamsCache.has(cacheKey)) {
      return this.gameParamsCache.get(cacheKey)!;
    }

    let targetNumber: number;
    let multiplier: number;
    let winChance: number;

    if (dto.targetNumber !== undefined) {
      targetNumber = dto.targetNumber;

      if (dto.betType === DiceBetType.ROLL_OVER) {
        winChance = 99.99 - targetNumber;
      } else {
        winChance = targetNumber;
      }

      const houseEdge = this.houseEdgeService.getEdge('dice');
      if (!houseEdge) {
        throw new Error('House edge not found for dice game');
      }
      multiplier = (100 - houseEdge) / winChance;
    } else if (dto.multiplier !== undefined) {
      multiplier = dto.multiplier;
      const houseEdge = this.houseEdgeService.getEdge('dice');
      if (!houseEdge) {
        throw new Error('House edge not found for dice game');
      }
      winChance = (100 - houseEdge) / multiplier;

      if (dto.betType === DiceBetType.ROLL_OVER) {
        targetNumber = 99.99 - winChance;
      } else {
        targetNumber = winChance;
      }
    } else {
      throw new BadRequestException('Invalid game parameters');
    }

    const result = {
      targetNumber: Math.round(targetNumber * 100) / 100,
      multiplier: Math.round(multiplier * 10000) / 10000,
      winChance: Math.round(winChance * 100) / 100,
    };

    // Cache the result for future use
    this.gameParamsCache.set(cacheKey, result);

    // Clear oldest entries if cache gets too large (prevent memory leaks)
    if (this.gameParamsCache.size > this.MAX_CACHE_SIZE) {
      const keysToDelete = Array.from(this.gameParamsCache.keys()).slice(0, 100);
      keysToDelete.forEach((key) => this.gameParamsCache.delete(key));
      this.logger.debug(`Cleaned dice game params cache, removed ${keysToDelete.length} entries`);
    }

    // Log cache performance periodically
    if (this.gameParamsCache.size % 100 === 0) {
      this.logger.debug(`Dice game params cache size: ${this.gameParamsCache.size} entries`);
    }

    return result;
  }

  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  private determineBetResult(
    rollResult: number,
    targetNumber: number,
    betType: DiceBetType,
  ): boolean {
    if (betType === DiceBetType.ROLL_OVER) {
      return rollResult > targetNumber;
    } else {
      return rollResult < targetNumber;
    }
  }

  private async mapToResponseDto(bet: DiceBetEntity, isOwner = true): Promise<DiceBetResponseDto> {
    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([bet.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === bet.userId);

    // Phase 1: Only fetch and calculate fiat data if owner
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;
    let originalFiatAmount: string | undefined;
    let originalFiatCurrency: CurrencyEnum | undefined;
    let userBet: any;

    if (isOwner) {
      // Get fiat preservation data from user_bets table
      userBet = await this.userBetService.getUserBetById(GameTypeEnum.DICE, bet.id);

      // Calculate fiat payout if fiat data exists (prioritize bet entity, fallback to user_bets) - LEGACY SUPPORT
      // Use fiat data from bet entity if available (newer approach)
      if (bet.originalFiatAmount && bet.originalFiatCurrency && bet.multiplier) {
        originalFiatAmount = bet.originalFiatAmount;
        originalFiatCurrency = bet.originalFiatCurrency;
        const fiatBetAmount = new BigNumber(bet.originalFiatAmount);
        const multiplier = new BigNumber(bet.multiplier);
        const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
        payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
        payoutFiatCurrency = bet.originalFiatCurrency;
      }
      // Fallback to user_bets table (legacy approach)
      else if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && bet.multiplier) {
        originalFiatAmount = userBet.originalFiatAmount;
        originalFiatCurrency = userBet.originalFiatCurrency;
        const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
        const multiplier = new BigNumber(bet.multiplier);
        const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
        payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
        payoutFiatCurrency = userBet.originalFiatCurrency;
      }
    }

    // Base response without fiat preservation data
    const baseResponse = {
      id: bet.id,
      userId: bet.userId,
      user: bet.user?.isPrivate
        ? null
        : {
            id: bet.user.id,
            userName: bet.user.displayName || bet.user.username,
            levelImageUrl: userVipStatus?.vipLevelImage || '',
          },
      betAmount: bet.betAmount,
      asset: bet.asset,
      betType: bet.betType,
      targetNumber: bet.targetNumber,
      multiplier: bet.multiplier,
      winChance: bet.winChance,
      rollResult: bet.rollResult,
      status: bet.status,
      winAmount: bet.winAmount,
      clientSeed: bet.clientSeed,
      nonce: bet.nonce,
      serverSeedHash: bet.serverSeedHash,
      serverSeed: bet.serverSeed,
      createdAt: bet.createdAt,
    };

    // Phase 1: Only include fiat preservation data for bet owner's personal records
    if (isOwner) {
      return {
        ...baseResponse,
        originalFiatAmount,
        originalFiatCurrency,
        fiatToUsdRate: bet.fiatToUsdRate || userBet?.fiatToUsdRate,
        payoutFiatAmount,
        payoutFiatCurrency,
      };
    }

    return baseResponse;
  }
}
