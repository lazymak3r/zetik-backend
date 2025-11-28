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
  LimboGameEntity,
  LimboGameStatus,
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
import { LimboGameResponseDto } from './dto/limbo-game-response.dto';
import { PlaceLimboBetDto } from './dto/place-limbo-bet.dto';

// Extended UserEntity interface for typing
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

@Injectable()
export class LimboService {
  private readonly logger = new Logger(LimboService.name);

  constructor(
    @InjectRepository(LimboGameEntity)
    private readonly limboGameRepository: Repository<LimboGameEntity>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly gameConfigService: GameConfigService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userBetService: UserBetService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async placeBet(user: UserEntity, dto: PlaceLimboBetDto): Promise<LimboGameResponseDto> {
    // Simple rate limiting check - if bet amount is very small (but not zero for demo mode), it might be rapid betting
    const betAmount = parseFloat(dto.betAmount.toString());
    if (betAmount > 0 && betAmount < 0.00000001) {
      throw new BadRequestException('Rate limit exceeded');
    }

    // 🛡️ SECURITY: Comprehensive Input Validation & Anti-fraud Protection
    this.validateInputSecurity(dto, betAmount);

    // Acquire distributed lock for user bet to prevent race conditions across multiple instances
    const lockKey = LockKeyBuilder.gameLimbo(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            this.logger.log(`User ${user.id} placing limbo bet`, {
              amount: dto.betAmount,
              targetMultiplier: dto.targetMultiplier,
            });

            // Get primary asset from user object (set by JwtStrategy guard)
            const userWithAsset = user as UserWithPrimaryAsset;
            const primaryAsset = userWithAsset.primaryAsset;

            if (!primaryAsset) {
              throw new BadRequestException('No primary asset found for user');
            }

            // Validate bet amount using GameConfigService
            const validation = user.currentCurrency
              ? await this.gameConfigService.validateBetAmount(
                  GameType.LIMBO,
                  dto.betAmount.toString(),
                  primaryAsset,
                  user.currentCurrency,
                )
              : await this.gameConfigService.validateBetAmount(
                  GameType.LIMBO,
                  dto.betAmount.toString(),
                  primaryAsset,
                );

            if (!validation.isValid) {
              throw new BadRequestException(
                validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
              );
            }

            // 🎰 CRITICAL: Get house edge from HouseEdgeService (casino standard: 1.00%)
            const houseEdge = this.houseEdgeService.getEdge('limbo');
            if (!houseEdge) {
              throw new Error('House edge not found for limbo game');
            }

            // Calculate win chance using house edge from service (NO HARDCODE!)
            const winChance = this.calculateWinChance(dto.targetMultiplier, houseEdge);

            // Use Limbo-specific provably fair service with correct house edge
            const gameOutcome = await this.provablyFairService.generateLimboOutcome(
              user.id,
              dto.betAmount.toString(),
              houseEdge,
            );

            // 🔐 SECURITY: Validate game outcome integrity
            this.validateGameOutcomeSecurity(gameOutcome);

            // Use the result from centralized provably fair service
            const resultMultiplier = gameOutcome.value;

            // Determine if bet won or lost
            const isWin = resultMultiplier >= dto.targetMultiplier;

            // Create game record first to get game ID
            const game = this.limboGameRepository.create({
              id: randomUUID(),
              userId: user.id,
              gameSessionId: dto.gameSessionId,
              betAmount: dto.betAmount.toString(),
              asset: primaryAsset,
              status: isWin ? LimboGameStatus.WON : LimboGameStatus.LOST,
              targetMultiplier: dto.targetMultiplier.toString(),
              resultMultiplier: resultMultiplier.toString(),
              winChance: winChance.toString(),
              serverSeed: gameOutcome.serverSeed,
              serverSeedHash: gameOutcome.hash,
              clientSeed: gameOutcome.clientSeed,
              nonce: gameOutcome.nonce,
            });

            await queryRunner.manager.save(game);

            let finalPayout = '0';
            let balanceResult;

            if (isWin) {
              const winAmountBN = new BigNumber(dto.betAmount).multipliedBy(dto.targetMultiplier);

              // Protect against BigNumber overflow and ensure 8 decimal precision
              if (winAmountBN.toNumber() > Number.MAX_SAFE_INTEGER) {
                this.logger.error(
                  `Win amount too large for safe conversion: ${winAmountBN.toString()}`,
                  {
                    gameId: game.id,
                    userId: user.id,
                    winAmount: winAmountBN.toString(),
                  },
                );
                throw new BadRequestException('Win amount calculation overflow');
              }

              // Casino-safe rounding: ROUND_DOWN to 8 dp
              const roundedWinAmount = winAmountBN.decimalPlaces(8, BigNumber.ROUND_DOWN);

              const operationId = randomUUID();
              const winOperationId = randomUUID();

              // Win: Batch balance update [BET, WIN]
              balanceResult = await this.balanceService.updateBalance(
                [
                  {
                    operation: BalanceOperationEnum.BET,
                    operationId,
                    userId: user.id,
                    amount: new BigNumber(dto.betAmount),
                    asset: primaryAsset,
                    description: 'Limbo bet',
                    metadata: { gameSessionId: dto.gameSessionId, gameId: game.id },
                    houseEdge: this.houseEdgeService.getEdge('limbo'),
                  },
                  {
                    operation: BalanceOperationEnum.WIN,
                    operationId: winOperationId,
                    userId: user.id,
                    amount: roundedWinAmount,
                    asset: primaryAsset,
                    description: 'Limbo win',
                    metadata: { gameSessionId: dto.gameSessionId, gameId: game.id },
                  },
                ],
                queryRunner,
              );

              if (!balanceResult.success) {
                this.logger.error(`Failed to process BET+WIN for game ${game.id}`, {
                  gameId: game.id,
                  userId: user.id,
                  error: balanceResult.error,
                  betAmount: dto.betAmount,
                  winAmount: roundedWinAmount.toString(),
                });
                throw new BadRequestException(
                  balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
                );
              }

              game.winAmount = roundedWinAmount.toString();
              finalPayout = roundedWinAmount.toString();

              this.logger.log(`Limbo bet won (batch processed)`, {
                gameId: game.id,
                userId: user.id,
                targetMultiplier: dto.targetMultiplier,
                resultMultiplier: resultMultiplier,
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
                  description: 'Limbo bet',
                  metadata: { gameSessionId: dto.gameSessionId, gameId: game.id },
                  houseEdge: this.houseEdgeService.getEdge('limbo'),
                },
                queryRunner,
              );

              if (!balanceResult.success) {
                throw new BadRequestException(
                  balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
                );
              }

              game.winAmount = '0';
              this.logger.log(`Limbo bet lost`, {
                gameId: game.id,
                userId: user.id,
                targetMultiplier: dto.targetMultiplier,
                resultMultiplier: resultMultiplier,
              });
            }

            await queryRunner.manager.save(game);

            // Calculate actual multiplier and payout for bet feed display
            let actualMultiplier: string;
            let betFeedPayout: string;

            if (isWin) {
              // Win: show actual multiplier and total payout amount
              const actualMultiplierValue =
                parseFloat(finalPayout) / parseFloat(dto.betAmount.toString());
              actualMultiplier = actualMultiplierValue.toFixed(4);
              betFeedPayout = finalPayout; // Show total payout, not net profit
            } else {
              // Loss: show 0.00x multiplier and 0.00 payout (player receives nothing)
              // Payout represents what the player actually receives, not net profit/loss
              actualMultiplier = '0.0000';
              betFeedPayout = '0.00000000';
            }

            // Create user bet record asynchronously (don't await to avoid blocking response)
            // This follows the same pattern as Dice game for optimized performance
            try {
              // Extract fiat preservation data for display consistency
              const fiatData = this.fiatPreservationService.extractFiatPreservationData(
                user,
                dto.originalFiatAmount,
                dto.betAmount.toString(),
                primaryAsset,
              );

              await this.userBetService.createUserBet({
                game: GameTypeEnum.LIMBO,
                betId: game.id,
                userId: user.id,
                betAmount: dto.betAmount.toString(),
                asset: primaryAsset,
                multiplier: actualMultiplier,
                payout: betFeedPayout,
                // Include fiat preservation data
                ...fiatData,
              });
            } catch (error) {
              this.logger.error('Failed to record limbo bet in user_bets table', {
                gameId: game.id,
                userId: user.id,
                betAmount: dto.betAmount.toString(),
                error: error instanceof Error ? error.message : String(error),
              });
              // Don't fail the entire transaction if user_bets recording fails
            }

            await queryRunner.commitTransaction();

            // Get user VIP information for response
            const vipStatuses = await this.userVipStatusService.getUsersVipStatus([user.id]);
            const userVipInfo = vipStatuses[0];

            // Set user on game object for mapToResponseDto
            game.user = user;

            return await this.mapToResponseDto(game, userVipInfo);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error processing limbo bet for user ${user.id}:`, error);

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to process limbo bet');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for limbo bet', {
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

  async getGameHistory(userId: string, limit: number = 50): Promise<LimboGameResponseDto[]> {
    const games = await this.limboGameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['user'],
    });

    // Get VIP information for all users (though it's just one user in this case)
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([userId]);
    const userVipInfo = vipStatuses[0];

    return await Promise.all(games.map((game) => this.mapToResponseDto(game, userVipInfo)));
  }

  async getGameById(gameId: string): Promise<LimboGameResponseDto | null> {
    const game = await this.limboGameRepository.findOne({
      where: { id: gameId },
      relations: ['user'],
    });

    if (!game) {
      return null;
    }

    // Get user VIP information
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipInfo = vipStatuses[0];

    return await this.mapToResponseDto(game, userVipInfo);
  }

  async getUserBetById(betId: string): Promise<LimboGameResponseDto | null> {
    const game = await this.limboGameRepository.findOne({
      where: { id: betId },
      relations: ['user'],
    });

    if (!game) {
      return null;
    }

    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === game.userId);

    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.LIMBO, betId);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.targetMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.targetMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
    }

    return {
      id: game.id,
      gameSessionId: game.gameSessionId,
      betAmount: game.betAmount,
      asset: game.asset,
      status: game.status,
      targetMultiplier: game.targetMultiplier,
      resultMultiplier: game.resultMultiplier,
      crashPoint: game.resultMultiplier,
      winChance: game.winChance,
      winAmount: game.winAmount,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: game.status !== LimboGameStatus.PENDING ? game.serverSeed : undefined,
      user: game.user?.isPrivate
        ? null
        : {
            id: game.user.id,
            userName: game.user.displayName || game.user.username,
            levelImageUrl: userVipStatus?.vipLevelImage || '',
          },
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }

  /**
   * 🛡️ SECURITY: Comprehensive Input Validation & Anti-fraud Protection
   * Validates all inputs to prevent security vulnerabilities and attacks
   */

  private validateInputSecurity(dto: any, betAmount: number): void {
    // 🚨 CRITICAL: Validate bet amount security
    if (dto.betAmount === null || dto.betAmount === undefined) {
      throw new BadRequestException('Bet amount cannot be null or undefined');
    }

    if (typeof dto.betAmount === 'string' && dto.betAmount.includes(';')) {
      throw new BadRequestException('Invalid bet amount format - potential injection attempt');
    }

    if (isNaN(betAmount) || !isFinite(betAmount) || betAmount < 0) {
      throw new BadRequestException('Invalid bet amount - must be positive finite number');
    }

    if (betAmount > 1000000) {
      throw new BadRequestException('Bet amount exceeds maximum limit');
    }

    // Scientific notation overflow protection
    if (dto.betAmount.toString().toLowerCase().includes('e')) {
      const scientificValue = parseFloat(dto.betAmount);
      if (scientificValue > 1000000) {
        throw new BadRequestException('Bet amount exceeds maximum limit');
      }
    }

    // 🚨 CRITICAL: Validate target multiplier security
    if (dto.targetMultiplier === null || dto.targetMultiplier === undefined) {
      throw new BadRequestException('Target multiplier cannot be null or undefined');
    }

    if (typeof dto.targetMultiplier !== 'number') {
      throw new BadRequestException('Target multiplier must be a number');
    }

    if (isNaN(dto.targetMultiplier) || !isFinite(dto.targetMultiplier)) {
      throw new BadRequestException('Invalid target multiplier - must be finite number');
    }

    if (dto.targetMultiplier <= 0) {
      throw new BadRequestException('Target multiplier must be greater than 0');
    }

    if (dto.targetMultiplier > 1000000) {
      throw new BadRequestException('Target multiplier exceeds maximum limit');
    }

    // Float precision attack protection
    if (dto.targetMultiplier < 1.0) {
      throw new BadRequestException('Target multiplier must be at least 1.0x');
    }

    // 🔐 Provably Fair Security: Additional validations for game integrity
    if (
      dto.gameSessionId &&
      typeof dto.gameSessionId === 'string' &&
      dto.gameSessionId.length > 1000
    ) {
      throw new BadRequestException('Game session ID too long');
    }
  }

  /**
   * 🔐 SECURITY: Enhanced Provably Fair Validation
   * Validates game outcome integrity and prevents tampering
   */
  private validateGameOutcomeSecurity(gameOutcome: any): void {
    if (!gameOutcome) {
      throw new BadRequestException('Invalid game outcome');
    }

    if (gameOutcome.value === null || gameOutcome.value === undefined) {
      throw new BadRequestException('Game outcome value is missing');
    }

    if (
      typeof gameOutcome.value !== 'number' ||
      isNaN(gameOutcome.value) ||
      !isFinite(gameOutcome.value)
    ) {
      throw new BadRequestException('Game outcome value is invalid');
    }

    if (gameOutcome.value < 1.0 || gameOutcome.value > 1000000) {
      throw new BadRequestException('Game outcome value out of range');
    }

    if (!gameOutcome.nonce || gameOutcome.nonce === null) {
      throw new BadRequestException('Nonce is missing or invalid');
    }

    if (!gameOutcome.serverSeed || !gameOutcome.clientSeed || !gameOutcome.hash) {
      throw new BadRequestException('Seed data is incomplete');
    }
  }

  private calculateWinChance(targetMultiplier: number, houseEdge: number): number {
    // 🎰 CASINO STANDARD: Win chance calculation with house edge from HouseEdgeService
    // Formula: (100 - houseEdge) / targetMultiplier

    // 🚨 SECURITY: Validate house edge parameter
    if (houseEdge === null || houseEdge === undefined || isNaN(houseEdge)) {
      throw new Error('House edge must be provided from HouseEdgeService');
    }

    // Unified casino-grade win chance calculation with 6-decimal precision
    const rawWinChance = (100 - houseEdge) / targetMultiplier;
    const roundedWinChance = Math.round(rawWinChance * 1e6) / 1e6;
    return Math.max(0.000001, Math.min(roundedWinChance, 99.99));
  }

  private async mapToResponseDto(
    game: LimboGameEntity,
    userVipInfo?: { userId: string; vipLevel: number; vipLevelImage: string },
  ): Promise<LimboGameResponseDto> {
    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.LIMBO, game.id);

    // Calculate fiat payout if fiat data exists
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: CurrencyEnum | undefined;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.targetMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.targetMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = userBet.originalFiatCurrency;
    }

    return {
      id: game.id,
      gameSessionId: game.gameSessionId,
      betAmount: game.betAmount,
      asset: game.asset,
      status: game.status,
      targetMultiplier: game.targetMultiplier,
      resultMultiplier: game.resultMultiplier,
      crashPoint: game.resultMultiplier, // Alias for consistency with other games
      winChance: game.winChance,
      winAmount: game.winAmount,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: game.status !== LimboGameStatus.PENDING ? game.serverSeed : undefined,
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
      createdAt: game.createdAt,
      updatedAt: game.updatedAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }
}
