import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  GameType,
  GameTypeEnum,
  MinesGameEntity,
  MinesGameStatus,
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
import { AutoplayMinesDto } from './dto/autoplay-mines.dto';
import { CashoutMinesDto } from './dto/cashout-mines.dto';
import { MinesGameResponseDto } from './dto/mines-game-response.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { StartMinesGameDto } from './dto/start-mines-game.dto';

// Extended UserEntity interface for typing
interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

/**
 * Safely converts a string to CurrencyEnum if it's a valid enum value
 * @param currency - The currency string to convert
 * @returns CurrencyEnum if valid, undefined otherwise
 */
function safeCurrencyConversion(currency?: string): CurrencyEnum | undefined {
  if (!currency) return undefined;

  // Check if the string is a valid CurrencyEnum value
  if (Object.values(CurrencyEnum).includes(currency as CurrencyEnum)) {
    return currency as CurrencyEnum;
  }

  return undefined;
}

@Injectable()
export class MinesService implements OnModuleDestroy {
  private readonly logger = new Logger(MinesService.name);
  private readonly GRID_SIZE = 25; // 5x5 grid
  private readonly userActionTimestamps = new Map<string, number[]>(); // Rate limiting cache
  private cleanupInterval: NodeJS.Timeout | null = null; // Store interval reference for cleanup

  // Security limits
  private readonly MAX_MINES_SAFE = 24; // Maximum safe mines count for fair gameplay
  private readonly MAX_ACTIONS_PER_MINUTE = 120; // Increased for better UX
  private readonly MAX_PAYOUT_MULTIPLIER = 1000; // Maximum 1000x bet for casino protection

  constructor(
    @InjectRepository(MinesGameEntity)
    private readonly minesGameRepository: Repository<MinesGameEntity>,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly gameConfigService: GameConfigService,
    private readonly userBetService: UserBetService,
    private readonly provablyFairService: ProvablyFairService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly fiatPreservationService: FiatPreservationService,
    private readonly distributedLockService: DistributedLockService,
  ) {
    this.cleanupInterval = setInterval(
      () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [userId, timestamps] of this.userActionTimestamps.entries()) {
          const recentTimestamps = timestamps.filter((t) => t > fiveMinutesAgo);
          if (recentTimestamps.length === 0) {
            this.userActionTimestamps.delete(userId);
          } else {
            this.userActionTimestamps.set(userId, recentTimestamps);
          }
        }
      },
      5 * 60 * 1000,
    );
  }

  async startGame(user: UserEntity, dto: StartMinesGameDto): Promise<MinesGameResponseDto> {
    const lockKey = LockKeyBuilder.gameMines(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          // Get primary asset from user object (set by JwtStrategy guard)
          const userWithAsset = user as UserWithPrimaryAsset;
          const primaryAsset = userWithAsset.primaryAsset;

          this.validateGameParameters(dto);

          if (!primaryAsset) {
            throw new BadRequestException('No primary asset found for user');
          }

          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            this.logger.log(`User ${user.id} starting mines game`, {
              amount: dto.betAmount,
              asset: primaryAsset,
              minesCount: dto.minesCount,
            });

            // Validate bet amount using GameConfigService (uses lowercase GameType)
            const validation = await this.gameConfigService.validateBetAmount(
              GameType.MINES,
              dto.betAmount.toString(),
              primaryAsset || 'BTC',
            );

            if (!validation.isValid) {
              throw new BadRequestException(
                validation.error || ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_INVALID,
              );
            }

            // Check for existing active game
            const existingGame = await this.minesGameRepository.findOne({
              where: { userId: user.id, status: MinesGameStatus.ACTIVE },
            });

            if (existingGame) {
              throw new BadRequestException('You already have an active mines game');
            }

            // Extract fiat preservation data for display consistency
            const fiatData = this.fiatPreservationService.extractFiatPreservationData(
              user,
              dto.originalFiatAmount,
              dto.betAmount.toString(),
              primaryAsset,
            );

            // Deduct bet amount from user balance - simple BET operation only
            // (wins will be handled later in cashout with batch operations)
            const operationId = randomUUID();
            const balanceResult = await this.balanceService.updateBalance({
              operation: BalanceOperationEnum.BET,
              operationId,
              userId: user.id,
              amount: new BigNumber(dto.betAmount),
              asset: primaryAsset,
              description: 'Mines bet',
              metadata: { gameSessionId: dto.gameSessionId },
              houseEdge: this.houseEdgeService.getEdge('mines'),
            });

            if (!balanceResult.success) {
              throw new BadRequestException(
                balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
              );
            }

            // Generate provably fair outcome using centralized service
            const gameOutcome = await this.provablyFairService.generateGameOutcome(
              user.id,
              GameTypeEnum.MINES,
              dto.betAmount.toString(),
            );

            const minePositions = this.generateMinePositions(
              gameOutcome.serverSeed,
              gameOutcome.clientSeed,
              parseInt(gameOutcome.nonce),
              dto.minesCount,
            );

            const serverSeedHash = this.hashServerSeed(gameOutcome.serverSeed);

            const game = this.minesGameRepository.create({
              userId: user.id,
              gameSessionId: dto.gameSessionId,
              betAmount: dto.betAmount.toString(),
              asset: primaryAsset,
              minesCount: dto.minesCount,
              minePositions: minePositions,
              revealedTiles: [],
              // Industry standard: currentMultiplier starts at 1.00x (neutral/no profit state)
              // This matches Stake.com, Shuffle.com and other major casino platforms
              // Starting from 0.00x would deviate from industry standards and confuse players
              // who expect to see their total payout potential, not just profit margin
              currentMultiplier: '1.00000000',
              potentialPayout: new BigNumber(dto.betAmount)
                .decimalPlaces(8, BigNumber.ROUND_HALF_UP)
                .toFixed(8),
              status: MinesGameStatus.ACTIVE,
              clientSeed: gameOutcome.clientSeed,
              serverSeed: gameOutcome.serverSeed,
              serverSeedHash: serverSeedHash,
              nonce: parseInt(gameOutcome.nonce),
              // Include fiat preservation data
              originalFiatAmount: fiatData.originalFiatAmount,
              originalFiatCurrency: fiatData.originalFiatCurrency,
              fiatToUsdRate: fiatData.fiatToUsdRate,
            });

            await queryRunner.manager.save(game);
            await queryRunner.commitTransaction();

            // Get user VIP information for response
            const vipStatuses = await this.userVipStatusService.getUsersVipStatus([user.id]);
            const userVipInfo = vipStatuses[0];

            game.user = user;

            return await this.mapToResponseDto(game, false, userVipInfo);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error starting mines game for user ${user.id}:`, error);

            if (error instanceof BadRequestException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to start mines game');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for mines game start', {
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

  async revealTile(user: UserEntity, dto: RevealTileDto): Promise<MinesGameResponseDto> {
    // Rate limiting security
    this.enforceRateLimit(user.id);

    const lockKey = LockKeyBuilder.gameMines(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        LockTTL.FAST_OPERATION, // Fast game operation
        async () => {
          const game = await this.minesGameRepository.findOne({
            where: { id: dto.gameId, userId: user.id },
          });

          if (!game) {
            throw new NotFoundException('Game not found');
          }

          if (game.status !== MinesGameStatus.ACTIVE) {
            throw new BadRequestException('Game is not active');
          }

          if (game.revealedTiles.includes(dto.tilePosition)) {
            throw new BadRequestException('Tile already revealed');
          }

          // Check if tile is a mine
          const isMine = game.minePositions.includes(dto.tilePosition);

          if (isMine) {
            // Game over - player hit a mine
            game.status = MinesGameStatus.BUSTED;
            game.revealedTiles.push(dto.tilePosition);
            game.finalPayout = '0';

            await this.minesGameRepository.save(game);

            // Record losing bet in user_bets table
            try {
              // Loss: show 0.00x multiplier and negative payout (lost bet amount)
              const lostAmount = (-parseFloat(game.betAmount)).toFixed(8);
              await this.userBetService.createUserBet({
                userId: user.id,
                game: GameTypeEnum.MINES,
                betId: game.id,
                betAmount: game.betAmount,
                asset: game.asset,
                multiplier: '0.0000',
                payout: lostAmount,
                // Include fiat preservation data
                originalFiatAmount: game.originalFiatAmount,
                originalFiatCurrency: safeCurrencyConversion(game.originalFiatCurrency),
                fiatToUsdRate: game.fiatToUsdRate,
              });
            } catch (error) {
              this.logger.error('Failed to record mines bet', {
                gameId: game.id,
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            this.logger.log(`Mines game busted`, {
              gameId: game.id,
              userId: user.id,
              tilePosition: dto.tilePosition,
            });

            return await this.mapToResponseDto(game, true, null); // Reveal mines on bust
          } else {
            // Safe tile - update multiplier and payout
            game.revealedTiles.push(dto.tilePosition);

            const { multiplier, payout } = this.calculatePayoutForReveal(
              game.minesCount,
              game.revealedTiles.length,
              new BigNumber(game.betAmount),
            );

            // Check if all safe tiles have been revealed
            const totalSafeTiles = this.GRID_SIZE - game.minesCount;
            const allSafeTilesRevealed = game.revealedTiles.length >= totalSafeTiles;

            // Check if maximum payout multiplier is exceeded
            const maxPayoutExceeded = multiplier.gt(this.MAX_PAYOUT_MULTIPLIER);

            // Auto cashout conditions: all safe tiles revealed OR max payout exceeded
            if (allSafeTilesRevealed || maxPayoutExceeded) {
              // Apply security cap if needed
              const finalMultiplier = maxPayoutExceeded
                ? new BigNumber(this.MAX_PAYOUT_MULTIPLIER)
                : multiplier;

              const finalPayout = new BigNumber(game.betAmount)
                .multipliedBy(finalMultiplier)
                .decimalPlaces(8, BigNumber.ROUND_HALF_UP);

              // Auto cashout - complete the game
              game.status = MinesGameStatus.COMPLETED;
              game.currentMultiplier = finalMultiplier
                .decimalPlaces(8, BigNumber.ROUND_HALF_UP)
                .toFixed(8);
              game.finalPayout = finalPayout.toFixed(8);

              // Add winnings to user balance
              const operationId = randomUUID();
              const balanceResult = await this.balanceService.updateBalance({
                operation: BalanceOperationEnum.WIN,
                operationId,
                userId: user.id,
                amount: finalPayout,
                asset: game.asset,
                description: 'Mines auto-cashout win',
                metadata: {
                  gameId: game.id,
                  multiplier: game.currentMultiplier,
                  reason: allSafeTilesRevealed ? 'all_safe_tiles_revealed' : 'max_payout_reached',
                },
              });

              if (!balanceResult.success) {
                throw new InternalServerErrorException('Failed to update balance');
              }

              await this.minesGameRepository.save(game);

              // Record winning bet
              try {
                await this.userBetService.createUserBet({
                  userId: user.id,
                  game: GameTypeEnum.MINES,
                  betId: game.id,
                  betAmount: game.betAmount,
                  asset: game.asset,
                  multiplier: game.currentMultiplier,
                  payout: game.finalPayout,
                  // Include fiat preservation data
                  originalFiatAmount: game.originalFiatAmount,
                  originalFiatCurrency: safeCurrencyConversion(game.originalFiatCurrency),
                  fiatToUsdRate: game.fiatToUsdRate,
                });
              } catch (error) {
                this.logger.error('Failed to record mines bet', {
                  gameId: game.id,
                  userId: user.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              }

              return await this.mapToResponseDto(game, true, null); // Reveal mines on auto cashout
            } else {
              // Continue game - update current state
              game.currentMultiplier = multiplier
                .decimalPlaces(8, BigNumber.ROUND_HALF_UP)
                .toFixed(8);
              game.potentialPayout = payout.decimalPlaces(8, BigNumber.ROUND_HALF_UP).toFixed(8);

              await this.minesGameRepository.save(game);

              return await this.mapToResponseDto(game, false, null);
            }
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for mines tile reveal', {
          userId: user.id,
          gameId: dto.gameId,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async cashout(user: UserEntity, dto: CashoutMinesDto): Promise<MinesGameResponseDto> {
    const lockKey = LockKeyBuilder.gameMines(user.id);

    try {
      return await this.distributedLockService.withLock(
        lockKey,
        5000, // 5 second TTL (involves balance operations)
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const game = await queryRunner.manager.findOne(MinesGameEntity, {
              where: { id: dto.gameId, userId: user.id },
            });

            if (!game) {
              throw new NotFoundException('Game not found');
            }

            if (game.status !== MinesGameStatus.ACTIVE) {
              throw new BadRequestException('Game is not active');
            }

            if (game.revealedTiles.length === 0) {
              throw new BadRequestException('Cannot cash out without revealing any tiles');
            }

            // Recalculate multiplier with full precision to avoid rounding errors
            const { multiplier: preciseMultiplier } = this.calculatePayoutForReveal(
              game.minesCount,
              game.revealedTiles.length,
              new BigNumber(game.betAmount),
            );

            // Calculate final payout with proper rounding strategy like roulette
            const finalPayout = new BigNumber(game.betAmount)
              .multipliedBy(preciseMultiplier)
              .decimalPlaces(8, BigNumber.ROUND_DOWN);

            // Additional validation before balance update
            if (finalPayout.isNaN() || !finalPayout.isFinite()) {
              this.logger.error('Invalid final payout calculated', {
                gameId: game.id,
                userId: user.id,
                betAmount: game.betAmount,
                preciseMultiplier: preciseMultiplier.toString(),
                finalPayout: finalPayout.toString(),
              });
              throw new InternalServerErrorException('Invalid payout calculation');
            }

            // Validate payout amount is positive
            if (finalPayout.isLessThanOrEqualTo(0)) {
              this.logger.error('Final payout is not positive', {
                gameId: game.id,
                userId: user.id,
                finalPayout: finalPayout.toString(),
              });
              throw new BadRequestException('Invalid payout amount');
            }

            // Validate asset exists and is supported
            if (!game.asset) {
              this.logger.error('Game asset is undefined', {
                gameId: game.id,
                userId: user.id,
              });
              throw new InternalServerErrorException('Game asset not found');
            }

            // Update game status
            game.status = MinesGameStatus.COMPLETED;
            game.finalPayout = finalPayout.toFixed(8);

            // Add winnings to user balance
            const operationId = randomUUID();

            this.logger.log('Processing mines win payout', {
              gameId: game.id,
              userId: user.id,
              operationId,
              finalPayout: finalPayout.toString(),
              asset: game.asset,
            });

            const balanceResult = await this.balanceService.updateBalance({
              operation: BalanceOperationEnum.WIN,
              operationId,
              userId: user.id,
              amount: finalPayout,
              asset: game.asset,
              description: 'Mines win',
              metadata: { gameId: game.id, multiplier: game.currentMultiplier },
            });

            if (!balanceResult.success) {
              throw new InternalServerErrorException('Failed to update balance');
            }

            await queryRunner.manager.save(game);
            await queryRunner.commitTransaction();

            // Record winning bet in user_bets table
            try {
              await this.userBetService.createUserBet({
                userId: user.id,
                game: GameTypeEnum.MINES,
                betId: game.id,
                betAmount: game.betAmount,
                asset: game.asset,
                multiplier: game.currentMultiplier,
                payout: game.finalPayout,
                // Include fiat preservation data
                originalFiatAmount: game.originalFiatAmount,
                originalFiatCurrency: safeCurrencyConversion(game.originalFiatCurrency),
                fiatToUsdRate: game.fiatToUsdRate,
              });
            } catch (error) {
              this.logger.error('Failed to record mines bet', {
                gameId: game.id,
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }

            return await this.mapToResponseDto(game, true, null); // Reveal mines on cashout
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Error cashing out mines game for user ${user.id}:`, error);

            if (error instanceof BadRequestException || error instanceof NotFoundException) {
              throw error;
            }

            throw new InternalServerErrorException('Failed to cash out');
          } finally {
            await queryRunner.release();
          }
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for mines cashout', {
          userId: user.id,
          gameId: dto.gameId,
          lockResource: lockKey,
        });
        throw new InternalServerErrorException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async getActiveGame(userId: string): Promise<MinesGameResponseDto | null> {
    const game = await this.minesGameRepository.findOne({
      where: { userId, status: MinesGameStatus.ACTIVE },
    });

    if (!game) {
      return null;
    }

    return await this.mapToResponseDto(game, false, null);
  }

  async getGameHistory(userId: string, limit: number = 50): Promise<MinesGameResponseDto[]> {
    const games = await this.minesGameRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });

    return await Promise.all(
      games.map(
        async (game) =>
          await this.mapToResponseDto(game, game.status !== MinesGameStatus.ACTIVE, null),
      ),
    );
  }

  async getUserBetById(betId: string): Promise<any> {
    return await this.userBetService.getUserBetById(GameTypeEnum.MINES, betId);
  }

  async getGameDetails(gameId: string): Promise<MinesGameResponseDto> {
    const game = await this.minesGameRepository.findOne({
      where: { id: gameId },
      relations: ['user'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    // Get user VIP information
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([game.userId]);
    const userVipInfo = vipStatuses[0];

    return await this.mapToResponseDto(game, game.status !== MinesGameStatus.ACTIVE, userVipInfo);
  }

  async autoplay(user: UserEntity, autoplayDto: AutoplayMinesDto): Promise<MinesGameResponseDto> {
    const { betAmount, minesCount, tilePositions, gameSessionId } = autoplayDto;

    // Get primary asset from user object (optimization #2)
    const userWithAsset = user as UserWithPrimaryAsset;
    const primaryAsset = userWithAsset.primaryAsset;

    this.validateGameParameters({ betAmount, minesCount, gameSessionId } as StartMinesGameDto);

    if (!primaryAsset) {
      throw new BadRequestException('No primary asset found for user');
    }

    // Check for existing active game
    const existingGame = await this.minesGameRepository.findOne({
      where: { userId: user.id, status: MinesGameStatus.ACTIVE },
    });

    if (existingGame) {
      throw new BadRequestException('You already have an active mines game');
    }

    // Generate provably fair outcome
    const gameOutcome = await this.provablyFairService.generateGameOutcome(
      user.id,
      GameTypeEnum.MINES,
      betAmount.toString(),
    );

    const minePositions = this.generateMinePositions(
      gameOutcome.serverSeed,
      gameOutcome.clientSeed,
      parseInt(gameOutcome.nonce),
      minesCount,
    );

    // Simulate game without database operations for optimization
    let revealedTiles: number[] = [];
    let hitMine = false;
    let winAmount = new BigNumber(0);

    // Simulate tile reveals and store safe tiles count separately
    let safeTilesRevealed = 0;

    for (const position of tilePositions) {
      if (minePositions.includes(position)) {
        hitMine = true;
        break; // Hit mine - game over, no winnings
      }
      revealedTiles.push(position);
      safeTilesRevealed++;
    }

    // Calculate final result FIRST (before transparency modifications)
    let finalStatus: MinesGameStatus;
    let finalPayout = '0';
    let currentMultiplier = '1.0000';

    if (hitMine) {
      // LOSS: player hit a mine
      finalStatus = MinesGameStatus.BUSTED;
      finalPayout = '0';
      winAmount = new BigNumber(0);
    } else if (safeTilesRevealed > 0) {
      // WIN: player revealed safe tiles and wants to cash out
      const { multiplier, payout } = this.calculatePayoutForReveal(
        minesCount,
        safeTilesRevealed, // Use actual safe tiles count, not transparency array
        new BigNumber(betAmount),
      );

      winAmount = payout;
      finalStatus = MinesGameStatus.COMPLETED;
      finalPayout = winAmount.toFixed(8);
      currentMultiplier = multiplier.decimalPlaces(8, BigNumber.ROUND_HALF_UP).toFixed(8);
    } else {
      // Edge case: no tiles revealed, immediate cashout for bet amount (1:1, no house edge)
      finalStatus = MinesGameStatus.COMPLETED;
      finalPayout = betAmount.toString();
      winAmount = new BigNumber(betAmount);
    }

    // For transparency in autoplay: if hit mine, add all selected tiles to revealed
    if (hitMine) {
      revealedTiles = [...tilePositions]; // Show all selected tiles for transparency
    }

    // OPTIMIZATION #1: Batch balance operations like Dice
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let balanceResult;

      if (winAmount.isGreaterThan(0)) {
        // WIN: batch process BET + WIN operations (like Dice)
        const operationId = randomUUID();
        const winOperationId = randomUUID();

        balanceResult = await this.balanceService.updateBalance(
          [
            {
              operation: BalanceOperationEnum.BET,
              operationId,
              userId: user.id,
              amount: new BigNumber(betAmount).decimalPlaces(8, BigNumber.ROUND_HALF_UP),
              asset: primaryAsset,
              description: 'Mines autoplay bet',
              metadata: { gameSessionId, gameType: 'MINES' },
              houseEdge: this.houseEdgeService.getEdge('mines'),
            },
            {
              operation: BalanceOperationEnum.WIN,
              operationId: winOperationId,
              userId: user.id,
              amount: winAmount.decimalPlaces(8, BigNumber.ROUND_HALF_UP),
              asset: primaryAsset,
              description: 'Mines autoplay win',
              metadata: {
                gameSessionId,
                gameType: 'MINES',
                multiplier: currentMultiplier,
                tilesRevealed: revealedTiles.length,
              },
            },
          ],
          queryRunner,
        );
      } else {
        // LOSS: only BET operation (like Dice)
        const operationId = randomUUID();

        balanceResult = await this.balanceService.updateBalance(
          {
            operation: BalanceOperationEnum.BET,
            operationId,
            userId: user.id,
            amount: new BigNumber(betAmount).decimalPlaces(8, BigNumber.ROUND_HALF_UP),
            asset: primaryAsset,
            description: 'Mines autoplay bet',
            metadata: { gameSessionId, gameType: 'MINES' },
            houseEdge: this.houseEdgeService.getEdge('mines'),
          },
          queryRunner,
        );
      }

      if (!balanceResult.success) {
        throw new BadRequestException(
          balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
        );
      }

      // Create game entity with final state
      const serverSeedHash = this.hashServerSeed(gameOutcome.serverSeed);

      const game = this.minesGameRepository.create({
        userId: user.id,
        gameSessionId,
        betAmount: betAmount.toString(),
        asset: primaryAsset,
        minesCount,
        status: finalStatus,
        minePositions,
        revealedTiles,
        currentMultiplier,
        finalPayout,
        serverSeedHash,
        clientSeed: gameOutcome.clientSeed,
        nonce: parseInt(gameOutcome.nonce),
      });

      await queryRunner.manager.save(game);
      await queryRunner.commitTransaction();

      // Record bet for autoplay (both wins and losses) so live feed shows history
      if (game.id) {
        const isWin = winAmount.isGreaterThan(0);
        const feedMultiplier = isWin ? currentMultiplier : '0.0000';
        const feedPayout = isWin ? finalPayout : '0.00000000';

        this.userBetService
          .createUserBet({
            userId: user.id,
            game: GameTypeEnum.MINES,
            betId: game.id,
            betAmount: betAmount.toString(),
            asset: primaryAsset,
            multiplier: feedMultiplier,
            payout: feedPayout,
            // Include fiat preservation data
            originalFiatAmount: game.originalFiatAmount,
            originalFiatCurrency: safeCurrencyConversion(game.originalFiatCurrency),
            fiatToUsdRate: game.fiatToUsdRate,
          })
          .catch((error) => {
            this.logger.error('Failed to record mines autoplay bet', {
              gameId: game.id || 'unknown',
              userId: user.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }

      this.logger.log(`Mines autoplay ${hitMine ? 'lost' : 'won'} (batch processed)`, {
        gameId: game.id,
        userId: user.id,
        tilesRevealed: revealedTiles.length,
        hitMine,
        winAmount: winAmount.toString(),
      });

      return await this.mapToResponseDto(game, true, null); // Always reveal mines for autoplay
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateGameParameters(dto: StartMinesGameDto): void {
    // Use hardcoded validation for simplified system
    const minMines = 1;
    const maxMines = this.MAX_MINES_SAFE;
    const gridSize = this.GRID_SIZE;

    if (dto.minesCount < minMines) {
      throw new BadRequestException(`Mines count must be at least ${minMines}`);
    }

    if (dto.minesCount >= gridSize) {
      throw new BadRequestException('Too many mines for grid size');
    }

    if (dto.minesCount > maxMines) {
      throw new BadRequestException(`Maximum ${maxMines} mines allowed for fair gameplay`);
    }

    // Ensure at least 1 safe tile for minimum gameplay
    const safeTiles = gridSize - dto.minesCount;
    if (safeTiles < 1) {
      throw new BadRequestException('Must have at least 1 safe tile');
    }

    // Validate bet amount (allow 0 for demo mode)
    const betAmountNum = parseFloat(dto.betAmount);
    if (isNaN(betAmountNum) || betAmountNum < 0) {
      throw new BadRequestException('Bet amount cannot be negative');
    }
  }

  private enforceRateLimit(userId: string): void {
    const now = Date.now();
    const userTimestamps = this.userActionTimestamps.get(userId) || [];

    // Remove old timestamps (older than 1 minute)
    const oneMinuteAgo = now - 60 * 1000;
    const recentTimestamps = userTimestamps.filter((timestamp) => timestamp > oneMinuteAgo);

    if (recentTimestamps.length >= this.MAX_ACTIONS_PER_MINUTE) {
      throw new BadRequestException('Rate limit exceeded. Please slow down.');
    }

    // Add current timestamp
    recentTimestamps.push(now);
    this.userActionTimestamps.set(userId, recentTimestamps);
  }

  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  private generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    minesCount: number,
  ): number[] {
    const minePositions: number[] = [];
    const availablePositions = Array.from({ length: this.GRID_SIZE }, (_, i) => i);

    // Generate unique mine positions using cursor-based approach
    for (let cursor = 0; cursor < minesCount; cursor++) {
      // Generate random value using cursor
      const randomValue = this.provablyFairService.generateRandomValue(
        serverSeed,
        clientSeed,
        nonce.toString(),
        cursor,
      );

      // Select position from remaining available positions
      const index = Math.floor(randomValue * availablePositions.length);
      const selectedPosition = availablePositions.splice(index, 1)[0];
      minePositions.push(selectedPosition);
    }

    return minePositions.sort((a, b) => a - b);
  }

  private calculatePayoutForReveal(
    minesCount: number,
    revealedCount: number,
    betAmount: BigNumber,
  ): { multiplier: BigNumber; payout: BigNumber } {
    const totalTiles = this.GRID_SIZE;

    if (revealedCount <= 0) {
      // Industry standard: return 1.00x multiplier for initial state (no tiles revealed)
      // This represents neutral position where player gets back exactly their bet amount
      // All major casino platforms use this approach instead of showing 0.00x
      return { multiplier: new BigNumber(1), payout: betAmount };
    }

    const safeTiles = totalTiles - minesCount;
    let cumulativeMultiplier = new BigNumber(1);

    for (let i = 0; i < revealedCount; i++) {
      const tilesRemaining = totalTiles - i;
      const safeTilesRemaining = safeTiles - i;

      if (safeTilesRemaining <= 0) {
        throw new Error('Invalid calculation: no safe tiles remaining');
      }

      const stepMultiplier = new BigNumber(tilesRemaining).dividedBy(safeTilesRemaining);
      cumulativeMultiplier = cumulativeMultiplier.multipliedBy(stepMultiplier);
    }

    // Get house edge from service
    const houseEdgeValue = this.houseEdgeService.getEdge('mines');
    if (!houseEdgeValue || isNaN(houseEdgeValue) || houseEdgeValue < 0 || houseEdgeValue > 100) {
      throw new Error('House edge not found or invalid for mines game');
    }

    const houseEdgeMultiplier = new BigNumber(1).minus(
      new BigNumber(houseEdgeValue).dividedBy(100),
    );
    // Apply house edge to get final multiplier - pure mathematical calculation
    const finalMultiplier = cumulativeMultiplier.multipliedBy(houseEdgeMultiplier);

    // Industry standard: NO artificial minimum multipliers
    // All multipliers must be mathematically derived from probability theory
    // Any artificial inflation violates Malta Gaming Authority standards

    if (!finalMultiplier.isFinite() || finalMultiplier.isNaN() || finalMultiplier.lte(0)) {
      throw new Error('Invalid multiplier calculated');
    }

    const payout = betAmount.multipliedBy(finalMultiplier);
    return { multiplier: finalMultiplier, payout };
  }

  private async mapToResponseDto(
    game: MinesGameEntity,
    revealMines: boolean,
    userVipInfo?: any,
  ): Promise<MinesGameResponseDto> {
    // Get fiat preservation data from user_bets table
    const userBet = await this.userBetService.getUserBetById(GameTypeEnum.MINES, game.id);

    // Calculate fiat payout if fiat data exists (legacy support)
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: any;

    if (userBet?.originalFiatAmount && userBet.originalFiatCurrency && game.currentMultiplier) {
      const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
      const multiplier = new BigNumber(game.currentMultiplier);
      const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplier);
      payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
      payoutFiatCurrency = safeCurrencyConversion(userBet.originalFiatCurrency);
    }

    return {
      id: game.id,
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
      gameSessionId: game.gameSessionId,
      betAmount: game.betAmount,
      asset: game.asset,
      minesCount: game.minesCount,
      minePositions: revealMines ? game.minePositions : null,
      revealedTiles: game.revealedTiles,
      currentMultiplier: game.currentMultiplier,
      potentialPayout: game.potentialPayout,
      status: game.status,
      finalPayout: game.finalPayout || null,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce,
      serverSeed: revealMines ? game.serverSeed : null,
      createdAt: game.createdAt,
      originalFiatAmount: userBet?.originalFiatAmount,
      originalFiatCurrency: userBet?.originalFiatCurrency,
      fiatToUsdRate: userBet?.fiatToUsdRate,
      payoutFiatAmount,
      payoutFiatCurrency,
    };
  }

  onModuleDestroy(): void {
    // Clean up the interval to prevent memory leaks
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.log('Mines service cleanup interval cleared');
    }
  }
}
