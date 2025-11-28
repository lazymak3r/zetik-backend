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
  GameType,
  GameTypeEnum,
  PlinkoGameEntity,
  PlinkoGameStatus,
  RiskLevel,
  UserEntity,
} from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
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
import { PlacePlinkoBetDto } from './dto/place-plinko-bet.dto';
import { PlinkoConfigResponseDto, PlinkoGameResponseDto } from './dto/plinko-game-response.dto';

// Interface for user with primary asset from guard context
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset: AssetTypeEnum;
}

@Injectable()
export class PlinkoService {
  private readonly logger = new Logger(PlinkoService.name);

  // Multiplier tables matching industry standards (Stake.com) - FIXED to match frontend exactly
  private readonly multiplierTables: Record<RiskLevel, Record<number, number[]>> = {
    [RiskLevel.LOW]: {
      8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
      9: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
      10: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
      11: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
      12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
      13: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
      14: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
      15: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
      16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    },
    [RiskLevel.MEDIUM]: {
      8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
      9: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
      10: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
      11: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
      12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
      13: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
      14: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
      15: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
      16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    },
    [RiskLevel.HIGH]: {
      8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
      9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
      10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
      11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
      12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
      13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
      14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
      15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
      16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
    },
  };

  private readonly availableRowCounts = [8, 9, 10, 11, 12, 13, 14, 15, 16];

  constructor(
    @InjectRepository(PlinkoGameEntity)
    private readonly plinkoRepository: Repository<PlinkoGameEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly gameConfigService: GameConfigService,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userBetService: UserBetService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async placeBet(user: UserEntity, dto: PlacePlinkoBetDto): Promise<PlinkoGameResponseDto> {
    const lockKey = LockKeyBuilder.gamePlinko(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          // Get primary asset from user object (set by JwtStrategy guard)
          const userWithAsset = user as UserWithPrimaryAsset;
          const primaryAsset = userWithAsset.primaryAsset;

          this.validateBetParameters(dto);

          if (!primaryAsset) {
            throw new BadRequestException('No primary asset found for user');
          }

          // Round betAmount to 8 decimal places to match database precision
          const roundedBetAmount = new BigNumber(dto.betAmount).toFixed(8);

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            // Validate bet amount using GameConfigService
            const validation = await this.gameConfigService.validateBetAmount(
              GameType.PLINKO,
              roundedBetAmount,
              primaryAsset,
            );

            if (!validation.isValid) {
              throw new BadRequestException(
                validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
              );
            }

            // Generate provably fair outcome
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.PLINKO,
              roundedBetAmount,
            );

            // Simulate ball drop and determine bucket first
            const { bucketIndex, ballPath } = this.simulateBallDrop(
              gameOutcome.clientSeed,
              gameOutcome.serverSeed,
              parseInt(gameOutcome.nonce),
              dto.rowCount,
              // dto.riskLevel,
            );

            // Get multiplier and calculate winnings
            const multiplier = this.getMultiplier(dto.riskLevel, dto.rowCount, bucketIndex);
            const winAmount = this.calculateWinAmount(roundedBetAmount, multiplier);

            // Generate game ID for metadata
            const gameId = randomUUID();

            // Batch balance operations (following Dice pattern)
            let balanceResult;

            if (winAmount.isGreaterThan(0)) {
              // Win: batch process BET + WIN operations
              const operationId = randomUUID();
              const winOperationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                [
                  {
                    operation: BalanceOperationEnum.BET,
                    operationId,
                    userId: user.id,
                    amount: new BigNumber(roundedBetAmount),
                    asset: primaryAsset,
                    description: 'Plinko bet',
                    metadata: {
                      gameId: gameId,
                      gameType: 'PLINKO',
                      bucketIndex,
                      multiplier: multiplier.toString(),
                    },
                    houseEdge: this.houseEdgeService.getEdge('plinko'),
                  },
                  {
                    operation: BalanceOperationEnum.WIN,
                    operationId: winOperationId,
                    userId: user.id,
                    amount: winAmount,
                    asset: primaryAsset,
                    description: 'Plinko win',
                    metadata: {
                      gameId: gameId,
                      gameType: 'PLINKO',
                      bucketIndex,
                      multiplier: multiplier.toString(),
                    },
                  },
                ],
                queryRunner,
              );
            } else {
              // Loss: only BET operation
              const operationId = randomUUID();

              balanceResult = await this.balanceService.updateBalance(
                {
                  operation: BalanceOperationEnum.BET,
                  operationId,
                  userId: user.id,
                  amount: new BigNumber(roundedBetAmount),
                  asset: primaryAsset,
                  description: 'Plinko bet',
                  metadata: {
                    gameId: gameId,
                    gameType: 'PLINKO',
                    bucketIndex,
                    multiplier: multiplier.toString(),
                  },
                  houseEdge: this.houseEdgeService.getEdge('plinko'),
                },
                queryRunner,
              );
            }

            if (!balanceResult.success) {
              throw new BadRequestException(
                balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
              );
            }

            // Create game record
            const game = new PlinkoGameEntity();
            game.id = gameId;
            game.userId = user.id;
            game.asset = primaryAsset;
            game.betAmount = roundedBetAmount;
            game.riskLevel = dto.riskLevel;
            game.rowCount = dto.rowCount;
            game.bucketIndex = bucketIndex;
            game.multiplier = multiplier.toString();
            game.winAmount = winAmount.toFixed(8);
            game.status = PlinkoGameStatus.COMPLETED;
            game.clientSeed = gameOutcome.clientSeed;
            game.serverSeed = gameOutcome.serverSeed;
            game.serverSeedHash = gameOutcome.hash;
            game.nonce = parseInt(gameOutcome.nonce);
            game.ballPath = ballPath;

            await queryRunner.manager.save(game);

            // Create UserBet record for unified bet history
            // Calculate bet feed display values
            let betFeedMultiplier: string;
            let betFeedPayout: string;

            if (multiplier > 0) {
              // Any win (full or partial): show actual multiplier and actual payout amount
              betFeedMultiplier = multiplier.toFixed(4);
              betFeedPayout = winAmount.toFixed(8); // Show actual win amount (always positive)
            } else {
              // Complete loss: show 0.00x multiplier and 0.00 payout (player receives nothing)
              betFeedMultiplier = '0.0000';
              betFeedPayout = '0.00000000';
            }

            // Extract fiat preservation data for display consistency
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              roundedBetAmount,
              primaryAsset,
            );

            await this.userBetService.createUserBet({
              game: GameTypeEnum.PLINKO,
              betId: game.id,
              userId: user.id,
              betAmount: roundedBetAmount,
              asset: primaryAsset,
              multiplier: betFeedMultiplier,
              payout: betFeedPayout,
              // Include fiat preservation data
              ...fiatData,
            });

            // Note: Balance operations already handled above in batch

            await queryRunner.commitTransaction();

            // Get user VIP information for response
            const vipStatuses = await this.userVipStatusService.getUsersVipStatus([user.id]);
            const userVipInfo = vipStatuses[0];

            // Set user on game object for mapToResponseDto
            game.user = user;

            this.logger.log(
              `Plinko game completed for user ${user.id}: bucket ${bucketIndex}, multiplier ${multiplier.toString()}x, win ${winAmount.toFixed(8)}`,
            );

            return await this.mapToResponseDto(game, userVipInfo);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error in Plinko game for user ${user.id}:`, error);

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to process Plinko bet');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for plinko bet', {
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

  async getGameHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PlinkoGameResponseDto[]> {
    const games = await this.plinkoRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return await Promise.all(games.map((game) => this.mapToResponseDto(game, null)));
  }

  async getGameById(gameId: string): Promise<PlinkoGameResponseDto | null> {
    const game = await this.plinkoRepository.findOne({
      where: { id: gameId },
    });

    if (!game) {
      return null;
    }

    // Load user separately since PlinkoGameEntity doesn't have user relation
    const user = await this.userRepository.findOne({
      where: { id: game.userId },
    });

    if (user) {
      // Set user on game object for mapToResponseDto
      game.user = user;
    }

    // Get user VIP information
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipInfo = vipStatuses[0];

    return await this.mapToResponseDto(game, userVipInfo);
  }

  /**
   * Get user bet data by bet ID for fiat payout calculation
   */
  private async getUserBetById(betId: string): Promise<any> {
    return await this.userBetService.getUserBetById(GameTypeEnum.PLINKO, betId);
  }

  getConfiguration(): PlinkoConfigResponseDto {
    // Use hardcoded configuration for simplified system
    const houseEdge = this.houseEdgeService.getEdge('plinko');

    return {
      riskLevels: Object.values(RiskLevel),
      rowCounts: this.availableRowCounts,
      multiplierTables: this.multiplierTables,
      houseEdge: houseEdge!,
    };
  }

  private validateBetParameters(dto: PlacePlinkoBetDto): void {
    // Use hardcoded validation for simplified system
    if (!this.availableRowCounts.includes(dto.rowCount)) {
      throw new BadRequestException(
        `Invalid row count. Allowed values: ${this.availableRowCounts.join(', ')}`,
      );
    }

    if (!Object.values(RiskLevel).includes(dto.riskLevel)) {
      throw new BadRequestException(
        `Invalid risk level. Allowed values: ${Object.values(RiskLevel).join(', ')}`,
      );
    }
  }

  private simulateBallDrop(
    clientSeed: string,
    serverSeed: string,
    nonce: number,
    rowCount: number,
    // riskLevel: RiskLevel,
  ): { bucketIndex: number; ballPath: number[] } {
    // TRUE GALTON BOARD PHYSICS - Binomial Distribution Model
    // Pure 50/50 probability for ALL risk levels (industry standard)
    // Matches Stake.com and Shuffle.com implementation
    // Risk levels ONLY affect multiplier tables, NOT ball physics
    const ballPath: number[] = [];
    const bucketCount = rowCount + 1;

    // Start at top center (true Galton board)
    let leftSteps = 0; // Count of left movements
    ballPath.push(Math.floor(bucketCount / 2)); // Visual starting position

    // Pure 50/50 probability - NO RISK BIAS (industry standard)
    const leftProbability = 0.5;

    // Each row: independent binary decision (left vs right) using cursor
    for (let row = 1; row <= rowCount; row++) {
      // Use cursor-based random value generation for each row decision
      const randomValue = this.provablyFairService.generateRandomValue(
        serverSeed,
        clientSeed,
        nonce.toString(),
        row - 1, // cursor starts at 0
      );

      // Binary decision: left or right (pure 50/50)
      const goesLeft = randomValue < leftProbability;

      if (goesLeft) {
        leftSteps++;
      }

      // Calculate current visual position for path tracking
      const currentPosition = leftSteps; // Position based on left steps
      ballPath.push(currentPosition);
    }

    // Final bucket index = number of left steps taken
    const finalBucketIndex = leftSteps;

    return {
      bucketIndex: finalBucketIndex,
      ballPath,
    };
  }

  private getMultiplier(riskLevel: RiskLevel, rowCount: number, bucketIndex: number): number {
    const multipliers = this.multiplierTables[riskLevel][rowCount];
    if (!multipliers || bucketIndex < 0 || bucketIndex >= multipliers.length) {
      throw new Error('Invalid bucket index or multiplier configuration');
    }
    return multipliers[bucketIndex];
  }

  private calculateWinAmount(betAmount: string, multiplier: number): BigNumber {
    const bet = new BigNumber(betAmount);

    // Industry standard: Multiplier tables already include house edge in their mathematical design
    // The house edge comes from the probability distribution vs payout ratios, not from
    // reducing the advertised multipliers. If player hits 1000x, they get 1000x.
    return bet.multipliedBy(multiplier).decimalPlaces(8, BigNumber.ROUND_DOWN);
  }

  private async mapToResponseDto(
    game: PlinkoGameEntity,
    userVipInfo?: any,
  ): Promise<PlinkoGameResponseDto> {
    // Get fiat preservation data from user_bets table
    const userBet = await this.getUserBetById(game.id);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.multiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.multiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
    }

    return {
      id: game.id,
      userId: game.userId,
      user: game.user?.isPrivate
        ? null
        : userVipInfo
          ? {
              id: game.user?.id || game.userId,
              userName: game.user?.username || 'Unknown',
              levelImageUrl: userVipInfo.vipLevelImage,
            }
          : {
              id: game.userId,
              userName: 'Unknown',
              levelImageUrl: 'user-level/bronze-1',
            },
      asset: game.asset,
      betAmount: game.betAmount,
      riskLevel: game.riskLevel,
      rowCount: game.rowCount,
      bucketIndex: game.bucketIndex,
      multiplier: game.multiplier,
      winAmount: game.winAmount,
      status: game.status,
      clientSeed: game.clientSeed,
      serverSeedHash: game.serverSeedHash,
      nonce: game.nonce,
      ballPath: game.ballPath,
      createdAt: game.createdAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }
}
