import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  CrashBetEntity,
  CrashBetStatusEnum,
  CrashGameEntity,
  CrashGameStateEntity,
  CrashGameStatusEnum,
  CrashSeedEntity,
  GameSessionEntity,
  GameStatusEnum,
  GameType,
  GameTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { VipTierService } from '../../bonus/services/vip-tier.service';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { RedisService } from '../../common/services/redis.service';
import { gamesConfig } from '../../config/games.config';
import { FiatPreservationService } from '../services/fiat-preservation.service';
import { GameConfigService } from '../services/game-config.service';
import { HouseEdgeService } from '../services/house-edge.service';
import { UserBetService } from '../services/user-bet.service';
import { CRASH_CONSTANTS, validateCrashConstants } from './crash-constants';
import { CrashBetDetailsResponseDto } from './dto/crash-bet-details-response.dto';
import { CrashGameDetailsResponseDto } from './dto/crash-game-details-response.dto';
import { PlaceCrashBetDto } from './dto/place-crash-bet.dto';
import { IUserBet } from './interfaces/crash-game-details.interface';
import { CrashWebSocketService } from './services/crash-websocket.service';

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

export interface CrashGameInfo {
  id: string;
  status: CrashGameStatusEnum;
  crashPoint?: string;
  currentMultiplier?: string;
  timeRemaining?: number;
  betsCount: number;
  totalBetAmount: string;
  serverSeedHash: string;
  gameIndex: number;
}

export interface CrashGameInfoWithUser {
  id: string;
  status: CrashGameStatusEnum;
  crashPoint?: string;
  currentMultiplier?: string;
  timeRemaining?: number;
  betsCount: number;
  totalBetAmount: string;
  serverSeedHash: string;
  gameIndex: number;
  participants: CrashParticipant[];
}

export interface CrashBetInfo {
  id: string;
  betAmount: string;
  autoCashOutAt?: string;
  status: CrashBetStatusEnum;
  cashOutAt?: string;
  winAmount?: string;
  // Standardized display fields
  displayBetAmount?: string;
  displayBetCurrency?: string;
  displayPayout?: string;
  displayPayoutCurrency?: string;
  displayProfit?: string;
  displayProfitCurrency?: string;
}

export interface CrashParticipant {
  userId: string;
  username: string;
  vipLevelImageUrl?: string;
  betAmount: string;
  asset: string;
  autoCashOutAt?: string;
  status: CrashBetStatusEnum;
}

export interface CrashLeaderboardEntry {
  userId: string;
  username: string;
  vipLevelImageUrl?: string;
  cashOut: string;
  asset: AssetTypeEnum;
  autoCashOutAt?: string;
  cashOutAt?: string; // Real multiplier when user cashed out
}

@Injectable()
export class CrashService implements OnModuleDestroy {
  private readonly logger = new Logger(CrashService.name);

  // Game timing constants (fallback values)
  private readonly BETTING_TIME = gamesConfig().crash.bettingTime;

  // Current game state - thread-safe with locks
  private currentGame: CrashGameEntity | null = null;
  private gameTimer: NodeJS.Timeout | null = null;
  private gameStartTime: number = 0;

  // Thread safety locks for single-process execution
  private gameStateLock = false;
  private readonly PROCESS_IDENTIFIER = `crash-${process.pid}-${Date.now()}`;
  private readonly REDIS_GAME_LOCK_KEY = 'crash:game:lock';
  private readonly REDIS_GAME_LOCK_TTL = 30000; // 30 seconds
  private readonly LOCK_RENEWAL_INTERVAL = 15000; // 15 seconds (half TTL)
  private lockRenewalInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(CrashGameEntity)
    private readonly crashGameRepository: Repository<CrashGameEntity>,
    @InjectRepository(CrashBetEntity)
    private readonly crashBetRepository: Repository<CrashBetEntity>,

    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
    private readonly crashWebSocketService: CrashWebSocketService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly vipTierService: VipTierService,
    private readonly userBetService: UserBetService,
    private readonly gameConfigService: GameConfigService,
    private readonly houseEdgeService: HouseEdgeService,
    private readonly cryptoConverterService: CryptoConverterService,
    private readonly redisService: RedisService,
    private readonly fiatPreservationService: FiatPreservationService,
  ) {
    // Only initialize game loop if explicitly enabled (for crash-service)
    // Main backend will have CrashModule for API endpoints but won't run the game loop
    const enableGameLoop = process.env.ENABLE_CRASH_GAME_LOOP === 'true';

    if (enableGameLoop) {
      this.logger.log(
        '🎮 Crash game loop enabled - this service will manage the global crash game',
      );
      // Initialize first game on startup with a delay to ensure DB is ready
      setTimeout(() => {
        void this.initializeGame().catch((error) => {
          this.logger.error('Failed to initialize crash game on startup:', error);
        });
      }, 5000); // 5 second delay to ensure database is ready
    } else {
      this.logger.log('🎮 Crash game loop disabled - this service will only handle API requests');
    }
  }

  async onModuleDestroy() {
    // Clean up game timer and release lock on shutdown
    if (this.gameTimer) {
      clearTimeout(this.gameTimer);
      this.gameTimer = null;
    }
    if (this.lockRenewalInterval) {
      clearInterval(this.lockRenewalInterval);
      this.lockRenewalInterval = null;
    }
    await this.releaseGameLock();
    this.logger.log('Crash game service destroyed and lock released');
  }

  /**
   * Acquire distributed lock for single-process crash game execution
   */
  private async acquireGameLock(): Promise<boolean> {
    try {
      const acquired = await this.redisService.setNX(
        this.REDIS_GAME_LOCK_KEY,
        this.PROCESS_IDENTIFIER,
        this.REDIS_GAME_LOCK_TTL / 1000,
      );

      if (acquired) {
        this.logger.debug(`Acquired crash game lock: ${this.PROCESS_IDENTIFIER}`);
        // Set up lock renewal to prevent expiry during normal operation
        this.startLockRenewal();
      }

      return acquired;
    } catch (error) {
      this.logger.error('Failed to acquire crash game lock:', error);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseGameLock(): Promise<void> {
    try {
      const currentLock = await this.redisService.get(this.REDIS_GAME_LOCK_KEY);
      if (currentLock === this.PROCESS_IDENTIFIER) {
        await this.redisService.del(this.REDIS_GAME_LOCK_KEY);
        this.logger.debug(`Released crash game lock: ${this.PROCESS_IDENTIFIER}`);
      }
    } catch (error) {
      this.logger.error('Failed to release crash game lock:', error);
    }
  }

  /**
   * Start periodic lock renewal to prevent expiry
   */
  private startLockRenewal(): void {
    this.lockRenewalInterval = setInterval(() => {
      this.renewLock().catch((error) => {
        this.logger.error('Failed to renew lock:', error);
      });
    }, this.LOCK_RENEWAL_INTERVAL);
  }

  private async renewLock(): Promise<void> {
    try {
      const currentLock = await this.redisService.get(this.REDIS_GAME_LOCK_KEY);
      if (currentLock === this.PROCESS_IDENTIFIER) {
        await this.redisService.set(
          this.REDIS_GAME_LOCK_KEY,
          this.PROCESS_IDENTIFIER,
          this.REDIS_GAME_LOCK_TTL / 1000,
        );
      }
    } catch (error) {
      this.logger.error('Failed to renew crash game lock:', error);
    }
  }

  /**
   * Thread-safe method wrapper
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T | null> {
    if (this.gameStateLock) {
      this.logger.warn('Game operation already in progress, skipping...');
      return null;
    }

    this.gameStateLock = true;
    try {
      return await operation();
    } finally {
      this.gameStateLock = false;
    }
  }

  /**
   * Initialize the crash game system with optional delayed start
   * Only runs on the process that holds the distributed lock
   */
  private async initializeGame(): Promise<void> {
    try {
      // Wait a bit to ensure database connection is ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Attempt to acquire distributed lock for single-process execution
      const lockAcquired = await this.acquireGameLock();
      if (!lockAcquired) {
        this.logger.log(
          'Another process is running the crash game, this instance will handle bets only',
        );
        return;
      }

      this.logger.log('This process acquired the crash game lock and will manage the global game');

      // Check for delayed start configuration
      const delayMinutes = process.env.CRASH_GAME_START_DELAY_MINUTES;

      if (delayMinutes) {
        const delay = parseInt(delayMinutes, 10);

        // Validate delay range (1-60 minutes)
        if (delay >= 1 && delay <= 60) {
          const delayMs = delay * 60 * 1000; // Convert minutes to milliseconds

          this.logger.debug(
            `🕒 Crash game initialization delayed by ${delay} minutes (${delayMs}ms)`,
          );

          setTimeout(() => {
            this.logger.debug(
              `⏰ Starting delayed crash game initialization after ${delay} minutes`,
            );
            void this.performGameInitialization();
          }, delayMs);

          return; // Exit early, initialization will happen after delay
        } else {
          this.logger.debug(
            `No CRASH_GAME_START_DELAY_MINUTES (0 set or undefined): Starting immediately.`,
          );
        }
      }

      // No delay or invalid delay - start immediately
      this.logger.debug(`🚀 Starting crash game initialization immediately`);
      await this.performGameInitialization();
    } catch (error) {
      this.logger.error('Failed to initialize crash game:', error);
      // Create a new game as fallback
      await this.createNewGame();
    }
  }

  /**
   * Perform the actual game initialization logic
   */
  private async performGameInitialization(): Promise<void> {
    try {
      // Check if there's an active game
      const activeGame = await this.crashGameRepository.findOne({
        where: [
          { status: CrashGameStatusEnum.WAITING },
          { status: CrashGameStatusEnum.STARTING },
          { status: CrashGameStatusEnum.FLYING },
        ],
      });

      if (activeGame) {
        this.currentGame = activeGame;
        this.logger.debug(
          `Resumed active crash game ${activeGame.id} with status ${activeGame.status}`,
        );

        // Handle different game states
        if (activeGame.status === CrashGameStatusEnum.WAITING) {
          // Resume betting timer for waiting games
          this.logger.debug(`Resuming betting timer for waiting game ${activeGame.id}`);
          void this.scheduleBettingEnd();
        } else if (activeGame.status === CrashGameStatusEnum.FLYING) {
          await this.handleFlyingGameResume(activeGame);
        } else if (activeGame.status === CrashGameStatusEnum.STARTING) {
          // Game is starting, continue to flying phase
          setTimeout(() => {
            void this.flyGame();
          }, 2000);
        }
      } else {
        // Create new game
        await this.createNewGame();
      }
    } catch (error) {
      this.logger.error('Failed to perform game initialization:', error);
      // Create a new game as fallback
      await this.createNewGame();
    }
  }

  /**
   * Handle resumption of a flying game after restart
   */
  private async handleFlyingGameResume(game: CrashGameEntity): Promise<void> {
    if (!game.startedAt) {
      // Invalid state, end the game
      this.logger.warn(`Flying game ${game.id} has no startedAt time, ending game`);
      await this.endGame(game);
      return;
    }

    // Check if this is a pre-migration game (no gameIndex means old system)
    if (!game.gameIndex) {
      this.logger.warn(
        `Pre-migration flying game ${game.id} detected (no gameIndex), ending gracefully`,
      );
      await this.endGame(game);
      return;
    }

    // TIMEZONE FIX: Use database time for consistency
    // Query the game again to get fresh timestamp with proper timezone handling
    const freshGame = await this.crashGameRepository
      .createQueryBuilder('game')
      .select(['game.id', 'game.startedAt', 'game.crashPoint'])
      .where('game.id = :id', { id: game.id })
      .addSelect('EXTRACT(epoch FROM game.startedAt) * 1000', 'startedAtEpoch')
      .addSelect('EXTRACT(epoch FROM NOW()) * 1000', 'currentEpoch')
      .getRawOne();

    if (!freshGame) {
      this.logger.warn(`Game ${game.id} not found during resume, ending`);
      return;
    }

    const currentTime = parseFloat(freshGame.currentEpoch);
    const startTime = parseFloat(freshGame.startedAtEpoch);
    const elapsedTime = currentTime - startTime;
    const crashPoint = parseFloat(game.crashPoint);

    // Calculate expected crash time
    const expectedCrashTime = this.calculateCrashTime(crashPoint);

    this.logger.debug(
      `Game ${game.id} resume analysis: currentTime=${Math.round(currentTime)}, startTime=${Math.round(startTime)}, elapsed=${Math.round(elapsedTime / 1000)}s, crashPoint=${crashPoint}x, expectedCrash=${Math.round(expectedCrashTime / 1000)}s`,
    );

    if (elapsedTime >= expectedCrashTime) {
      // Game should have already crashed
      this.logger.debug(
        `Game ${game.id} should have already crashed (elapsed: ${Math.round(elapsedTime / 1000)}s, expected: ${Math.round(expectedCrashTime / 1000)}s), crashing now`,
      );
      await this.crashGame(game, crashPoint);
    } else {
      // Game is still flying, continue from current point
      // CRITICAL: Set gameStartTime to current time minus elapsed time for correct multiplier calculation
      this.gameStartTime = Date.now() - elapsedTime;
      const remainingTime = expectedCrashTime - elapsedTime;

      this.gameTimer = setTimeout(() => {
        void this.crashGame(game, crashPoint);
      }, remainingTime);

      this.logger.debug(
        `Resumed flying game ${game.id}, crashing in ${Math.round(remainingTime / 1000)}s at ${crashPoint}x (elapsed: ${Math.round(elapsedTime / 1000)}s)`,
      );

      // CRITICAL FIX: Start multiplier updates immediately for resumed games
      this.startMultiplierUpdates();
    }
  }

  /**
   * Start real-time multiplier updates for flying games
   */
  private startMultiplierUpdates(): void {
    if (!this.currentGame || this.currentGame.status !== CrashGameStatusEnum.FLYING) {
      return;
    }

    // Start real-time multiplier updates
    const multiplierInterval = setInterval(() => {
      if (!this.currentGame || this.currentGame.status !== CrashGameStatusEnum.FLYING) {
        clearInterval(multiplierInterval);
        return;
      }

      const elapsedTime = Date.now() - this.gameStartTime;
      const currentMultiplier = this.calculateCurrentMultiplier(elapsedTime);

      void this.crashWebSocketService.broadcastMultiplierUpdate({
        gameId: this.currentGame.id,
        multiplier: currentMultiplier.toFixed(2),
        timestamp: Date.now(),
      });
    }, 100); // Update every 100ms

    this.logger.debug(`Started multiplier updates for game ${this.currentGame.id}`);
  }

  /**
   * Get current game information
   */
  async getCurrentGame(): Promise<CrashGameInfo | null> {
    let gameToUse: CrashGameEntity | null = this.currentGame;

    // If not in memory, try to load from database (for backends without game loop)
    if (!gameToUse) {
      gameToUse = await this.crashGameRepository.findOne({
        where: {
          status: In([
            CrashGameStatusEnum.WAITING,
            CrashGameStatusEnum.STARTING,
            CrashGameStatusEnum.FLYING,
          ]),
        },
        order: { createdAt: 'DESC' },
      });

      if (!gameToUse) {
        return null;
      }
    }

    const betsCount = await this.crashBetRepository.count({
      where: { crashGameId: gameToUse.id },
    });

    const totalBetAmountResult = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select('SUM(CAST(bet.betAmount AS DECIMAL))', 'total')
      .where('bet.crashGameId = :gameId', { gameId: gameToUse.id })
      .getRawOne<{ total: string | null }>();

    const totalBetAmount = totalBetAmountResult?.total || '0';

    const gameInfo: CrashGameInfo = {
      id: gameToUse.id,
      status: gameToUse.status,
      betsCount,
      totalBetAmount: totalBetAmount,
      serverSeedHash: gameToUse.serverSeedHash,
      gameIndex: gameToUse.gameIndex || 0,
    };

    // Add status-specific information
    // Note: currentMultiplier only accurate when gameStartTime is set (in game loop service)
    if (gameToUse.status === CrashGameStatusEnum.FLYING && this.gameStartTime > 0) {
      const elapsedTime = Date.now() - this.gameStartTime;
      gameInfo.currentMultiplier = this.calculateCurrentMultiplier(elapsedTime).toFixed(2);
    }

    if (
      gameToUse.status === CrashGameStatusEnum.CRASHED ||
      gameToUse.status === CrashGameStatusEnum.ENDED
    ) {
      gameInfo.crashPoint = gameToUse.crashPoint;
    }

    return gameInfo;
  }

  /**
   * Get current game information with participants data
   */
  async getCurrentGameWithUser(): Promise<CrashGameInfoWithUser | null> {
    const gameInfo = await this.getCurrentGame();
    if (!gameInfo) {
      return null;
    }

    // Get all participants
    const participants = await this.getActiveParticipants();

    return {
      ...gameInfo,
      participants,
    };
  }

  /**
   * Place a bet on the current crash game
   */
  async placeBet(user: UserEntity, dto: PlaceCrashBetDto): Promise<CrashBetInfo> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current game - either from memory or database
      let freshGame: CrashGameEntity | null = null;

      if (this.currentGame) {
        // If we have it in memory, get fresh state from database
        freshGame = await queryRunner.manager.findOne(CrashGameEntity, {
          where: { id: this.currentGame.id },
        });
      } else {
        // If not in memory (backend without game loop), query database for WAITING game
        freshGame = await queryRunner.manager.findOne(CrashGameEntity, {
          where: { status: CrashGameStatusEnum.WAITING },
          order: { createdAt: 'DESC' },
        });
      }

      if (!freshGame || freshGame.status !== CrashGameStatusEnum.WAITING) {
        throw new BadRequestException('No active game available for betting');
      }

      // Update current game reference (only if game loop is running)
      if (this.currentGame) {
        this.currentGame = freshGame;
      }

      // Get primary asset from user object (set by JwtStrategy guard) - OPTIMIZATION 2
      const userWithAsset = user as UserWithPrimaryAsset;
      let primaryAsset = userWithAsset.primaryAsset;

      // Validate bet amount using dynamic configuration
      const betAmount = new BigNumber(dto.betAmount);
      if (primaryAsset) {
        await this.validateBetAmount(betAmount.toString(), primaryAsset, user);
      }

      // Acquire advisory transaction lock scoped to user+game to prevent race conditions without schema changes
      const [advisoryKeyOne, advisoryKeyTwo] = this.getAdvisoryLockKeys(user.id, freshGame.id);
      await queryRunner.query('SELECT pg_advisory_xact_lock($1, $2)', [
        advisoryKeyOne,
        advisoryKeyTwo,
      ]);

      // Check if user already has a bet in this game with FOR UPDATE lock to prevent race conditions
      const existingBet = await queryRunner.manager
        .createQueryBuilder(CrashBetEntity, 'bet')
        .where('bet.crashGameId = :crashGameId', { crashGameId: freshGame.id })
        .andWhere('bet.userId = :userId', { userId: user.id })
        .setLock('pessimistic_write')
        .getOne();

      if (existingBet) {
        throw new BadRequestException('You already have a bet in this game');
      }

      // Fallback to database lookup if primaryAsset not available (e.g., WebSocket context)
      if (!primaryAsset) {
        const primaryWallet = await this.balanceService.getPrimaryWallet(user.id);
        if (!primaryWallet) {
          throw new BadRequestException('No primary asset found for user');
        }
        primaryAsset = primaryWallet.asset;
      }

      const balanceResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: randomUUID(),
        userId: user.id,
        amount: betAmount,
        asset: primaryAsset,
        description: 'Crash bet',
        metadata: { crashGameId: freshGame.id },
        houseEdge: this.houseEdgeService.getEdge('crash'),
      });
      if (!balanceResult.success) {
        throw new BadRequestException(
          balanceResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
        );
      }

      // Extract fiat preservation data for display consistency
      const fiatData = this.fiatPreservationService.extractFiatPreservationData(
        user,
        dto.originalFiatAmount,
        dto.betAmount.toString(),
        primaryAsset,
      );

      // Create crash bet
      const crashBet = new CrashBetEntity();
      crashBet.id = randomUUID();
      crashBet.crashGameId = freshGame.id;
      crashBet.userId = user.id;
      crashBet.asset = primaryAsset; // Use asset from guard context
      crashBet.betAmount = dto.betAmount.toString(); // Convert number to string for database
      crashBet.autoCashOutAt = dto.autoCashOutAt?.toString();
      crashBet.clientSeed = undefined; // Crash game doesn't use client seeds - it's a global game
      crashBet.status = CrashBetStatusEnum.ACTIVE;
      // Include fiat preservation data
      crashBet.originalFiatAmount = fiatData.originalFiatAmount;
      crashBet.originalFiatCurrency = fiatData.originalFiatCurrency;
      crashBet.fiatToUsdRate = fiatData.fiatToUsdRate;

      const savedBet = await queryRunner.manager.save(CrashBetEntity, crashBet);

      // Create game session for audit
      const gameSession = new GameSessionEntity();
      gameSession.id = randomUUID();
      gameSession.userId = user.id;
      gameSession.gameType = GameTypeEnum.CRASH;
      gameSession.status = GameStatusEnum.ACTIVE;
      gameSession.asset = primaryAsset; // Use asset from guard context
      gameSession.betAmount = dto.betAmount.toString(); // Convert number to string for database
      gameSession.serverSeed = freshGame.serverSeed; // SECURITY: Only stored for audit - never exposed in responses
      gameSession.clientSeed = undefined; // Crash game doesn't use client seeds - it's a global game
      gameSession.nonce = freshGame.nonce;
      gameSession.gameConfig = {
        crashGameId: freshGame.id,
        autoCashOutAt: dto.autoCashOutAt,
      };

      await queryRunner.manager.save(GameSessionEntity, gameSession);

      await queryRunner.commitTransaction();

      // Record bet in user_bets table for /games/bets/history integration (after transaction)
      // NOTE: We don't create user_bets record here - it will be created when game resolves
      // This avoids intermediate updates and ensures only final results are recorded

      this.logger.log(`User ${user.id} placed crash bet`, {
        betId: savedBet.id,
        gameId: freshGame.id,
        amount: dto.betAmount,
        autoCashOut: dto.autoCashOutAt,
      });

      // Get VIP status for broadcast (user data already available from parameter)
      let userVipStatus = await this.userVipStatusService.getUserVipStatus(user.id);

      // Create initial VIP status if it doesn't exist
      if (!userVipStatus) {
        userVipStatus = await this.userVipStatusService.upsertUserVipStatus(user.id, {
          currentWager: '0.00',
          currentVipLevel: 0,
          previousVipLevel: 0,
        });
      }

      // Get VIP tier image URL
      const vipTier = await this.vipTierService.findTierByLevel(userVipStatus.currentVipLevel);
      const vipImageUrl = vipTier?.imageUrl || undefined;

      // Broadcast bet placed event
      this.crashWebSocketService.broadcastBetPlaced({
        gameId: freshGame.id,
        userId: user.id,
        username: user.username || 'Unknown',
        vipImageUrl,
        asset: primaryAsset,
        betAmount: savedBet.betAmount,
        autoCashOutAt: savedBet.autoCashOutAt,
      });

      return {
        id: savedBet.id,
        betAmount: savedBet.betAmount,
        autoCashOutAt: savedBet.autoCashOutAt,
        status: savedBet.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to place crash bet for user ${user.id}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
      // Use GameConfigService like blackjack does for uniform settings
      const validation = user?.currentCurrency
        ? await this.gameConfigService.validateBetAmount(
            GameType.CRASH,
            betAmount,
            asset,
            user.currentCurrency,
          )
        : await this.gameConfigService.validateBetAmount(GameType.CRASH, betAmount, asset);

      if (!validation.isValid) {
        throw new BadRequestException(validation.error);
      }

      this.logger.debug(`Bet amount ${betAmount} ${asset} validated using GameConfigService`);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Failed to validate bet amount:', error);

      // Ultimate fallback with hardcoded limits
      const betAmountBN = new BigNumber(betAmount);
      if (betAmountBN.isLessThan('0.00000001')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
      }
      if (betAmountBN.isGreaterThan('1000')) {
        throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_LARGE);
      }
    }
  }

  private getAdvisoryLockKeys(userId: string, gameId: string): [number, number] {
    const userKey = this.hashStringToInt32(userId);
    const gameKey = this.hashStringToInt32(gameId);
    return [userKey, gameKey];
  }

  private hashStringToInt32(input: string): number {
    let hash = 0;
    for (let index = 0; index < input.length; index++) {
      const charCode = input.charCodeAt(index);
      hash = (hash << 5) - hash + charCode;
      hash |= 0;
    }
    return hash;
  }

  /**
   * Cash out a bet manually
   */
  async cashOut(userId: string, betId: string): Promise<CrashBetInfo> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current game - either from memory or database
      let currentFlyingGame: CrashGameEntity | null = null;

      if (this.currentGame && this.currentGame.status === CrashGameStatusEnum.FLYING) {
        currentFlyingGame = this.currentGame;
      } else {
        // If not in memory (backend without game loop), query database for FLYING game
        currentFlyingGame = await queryRunner.manager.findOne(CrashGameEntity, {
          where: { status: CrashGameStatusEnum.FLYING },
          order: { createdAt: 'DESC' },
        });
      }

      if (!currentFlyingGame) {
        throw new BadRequestException('Game is not in flying state');
      }

      // Get bet with lock
      const bet = await queryRunner.manager.findOne(CrashBetEntity, {
        where: {
          id: betId,
          userId,
          status: CrashBetStatusEnum.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bet) {
        throw new NotFoundException('Active bet not found');
      }

      // Calculate current multiplier using game's startedAt time
      const gameStartTime =
        this.gameStartTime > 0
          ? this.gameStartTime
          : currentFlyingGame.startedAt?.getTime() || Date.now();
      const elapsedTime = Date.now() - gameStartTime;
      const currentMultiplier = this.calculateCurrentMultiplier(elapsedTime);

      // Calculate win amount
      const betAmount = new BigNumber(bet.betAmount);
      const winAmount = betAmount
        .multipliedBy(currentMultiplier)
        .decimalPlaces(8, BigNumber.ROUND_DOWN);

      // Update bet
      bet.status = CrashBetStatusEnum.CASHED_OUT;
      bet.cashOutAt = currentMultiplier.toFixed(2);
      bet.winAmount = winAmount.toFixed(8);
      bet.cashOutTime = new Date();

      await queryRunner.manager.save(CrashBetEntity, bet);

      // Credit win amount in crypto
      const winResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.WIN,
        operationId: randomUUID(),
        userId,
        amount: winAmount,
        asset: bet.asset,
        description: 'Crash win',
        metadata: { betId: bet.id },
      });

      if (!winResult.success) {
        throw new Error(`Failed to credit win amount: ${winResult.error}`);
      }

      // Update user_bets table with final payout
      this.logger.debug(`BEFORE creating user_bets for manual cash out`, {
        betId,
        game: GameTypeEnum.CRASH,
        winAmount: winAmount.toFixed(8),
        multiplier: currentMultiplier.toFixed(2),
      });

      await this.userBetService.createUserBet({
        game: GameTypeEnum.CRASH,
        betId: bet.id,
        userId: bet.userId,
        betAmount: bet.betAmount,
        asset: bet.asset,
        multiplier: currentMultiplier.toFixed(2),
        payout: winAmount.toFixed(8),
        // Include fiat preservation data
        originalFiatAmount: bet.originalFiatAmount,
        originalFiatCurrency: safeCurrencyConversion(bet.originalFiatCurrency),
        fiatToUsdRate: bet.fiatToUsdRate,
      });

      this.logger.debug(`AFTER creating user_bets for manual cash out`, {
        betId,
        game: GameTypeEnum.CRASH,
        winAmount: winAmount.toFixed(8),
        multiplier: currentMultiplier.toFixed(2),
      });

      await queryRunner.commitTransaction();

      this.logger.log(`User ${userId} cashed out crash bet`, {
        betId,
        multiplier: currentMultiplier.toFixed(2),
        winAmount: winAmount.toFixed(8),
      });

      // Broadcast cash out event
      this.crashWebSocketService.broadcastCashOut({
        gameId: currentFlyingGame.id,
        userId,
        betId,
        multiplier: currentMultiplier.toFixed(2),
        winAmount: winAmount.toFixed(8),
      });

      return {
        id: bet.id,
        betAmount: bet.betAmount,
        autoCashOutAt: bet.autoCashOutAt,
        status: bet.status,
        cashOutAt: bet.cashOutAt,
        winAmount: bet.winAmount,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to cash out bet ${betId} for user ${userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get user's bets for current game (optimized query)
   */
  async getUserBets(userId: string): Promise<CrashBetInfo[]> {
    this.logger.debug(
      `Getting user bets for userId: ${userId}, currentGame: ${this.currentGame?.id || 'null'}`,
    );

    // Get last 20 bets for the user across all games
    const bets = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'bet.id',
        'bet.betAmount',
        'bet.autoCashOutAt',
        'bet.status',
        'bet.cashOutAt',
        'bet.winAmount',
      ])
      .where('bet.userId = :userId', { userId })
      .orderBy('bet.createdAt', 'DESC')
      .limit(20)
      .getMany();

    this.logger.debug(
      `Found ${bets.length} bets for user ${userId} (last 20 bets across all games)`,
    );

    return bets.map((bet) => ({
      id: bet.id,
      betAmount: bet.betAmount,
      autoCashOutAt: bet.autoCashOutAt,
      status: bet.status,
      cashOutAt: bet.cashOutAt,
      winAmount: bet.winAmount,
    }));
  }

  /**
   * Get interrupted sessions for user (for reconnect handling)
   */
  async getInterruptedSessions(userId: string): Promise<CrashBetInfo[]> {
    // Get current game ID - either from memory or database
    let currentGameId: string | null = null;

    if (this.currentGame) {
      currentGameId = this.currentGame.id;
    } else {
      // Query database for active game
      const activeGame = await this.crashGameRepository.findOne({
        where: {
          status: In([
            CrashGameStatusEnum.WAITING,
            CrashGameStatusEnum.STARTING,
            CrashGameStatusEnum.FLYING,
          ]),
        },
        order: { createdAt: 'DESC' },
      });

      if (!activeGame) {
        return [];
      }
      currentGameId = activeGame.id;
    }

    const activeBets = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'bet.id',
        'bet.betAmount',
        'bet.autoCashOutAt',
        'bet.status',
        'bet.cashOutAt',
        'bet.winAmount',
      ])
      .where('bet.userId = :userId', { userId })
      .andWhere('bet.crashGameId = :gameId', { gameId: currentGameId })
      .andWhere('bet.status = :status', { status: CrashBetStatusEnum.ACTIVE })
      .getMany();

    return activeBets.map((bet) => ({
      id: bet.id,
      betAmount: bet.betAmount,
      autoCashOutAt: bet.autoCashOutAt,
      status: bet.status,
      cashOutAt: bet.cashOutAt,
      winAmount: bet.winAmount,
    }));
  }

  /**
   * Get current user's active bet in the current game
   */
  async getCurrentUserBet(userId: string): Promise<CrashBetInfo | null> {
    // Get current game ID - either from memory or database
    let currentGameId: string | null = null;

    if (this.currentGame) {
      currentGameId = this.currentGame.id;
    } else {
      // Query database for active game
      const activeGame = await this.crashGameRepository.findOne({
        where: {
          status: In([
            CrashGameStatusEnum.WAITING,
            CrashGameStatusEnum.STARTING,
            CrashGameStatusEnum.FLYING,
          ]),
        },
        order: { createdAt: 'DESC' },
      });

      if (!activeGame) {
        return null;
      }
      currentGameId = activeGame.id;
    }

    const activeBet = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'bet.id',
        'bet.betAmount',
        'bet.autoCashOutAt',
        'bet.status',
        'bet.cashOutAt',
        'bet.winAmount',
      ])
      .where('bet.userId = :userId', { userId })
      .andWhere('bet.crashGameId = :gameId', { gameId: currentGameId })
      .andWhere('bet.status = :status', { status: CrashBetStatusEnum.ACTIVE })
      .getOne();

    if (!activeBet) {
      return null;
    }

    return {
      id: activeBet.id,
      betAmount: activeBet.betAmount,
      autoCashOutAt: activeBet.autoCashOutAt,
      status: activeBet.status,
      cashOutAt: activeBet.cashOutAt,
      winAmount: activeBet.winAmount,
    };
  }

  /**
   * Get all active participants in the current game with user details
   */
  async getActiveParticipants(): Promise<CrashParticipant[]> {
    // Get current game ID - either from memory or database
    let currentGameId: string | null = null;

    if (this.currentGame) {
      currentGameId = this.currentGame.id;
    } else {
      // Query database for active game
      const activeGame = await this.crashGameRepository.findOne({
        where: {
          status: In([
            CrashGameStatusEnum.WAITING,
            CrashGameStatusEnum.STARTING,
            CrashGameStatusEnum.FLYING,
          ]),
        },
        order: { createdAt: 'DESC' },
      });

      if (!activeGame) {
        return [];
      }
      currentGameId = activeGame.id;
    }

    const activeBets = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'bet.userId',
        'bet.betAmount',
        'bet.asset',
        'bet.autoCashOutAt',
        'bet.status',
        'user.username',
      ])
      .leftJoin('bet.user', 'user')
      .where('bet.crashGameId = :gameId', { gameId: currentGameId })
      .andWhere('bet.status = :status', { status: CrashBetStatusEnum.ACTIVE })
      .getMany();

    if (!activeBets.length) {
      return [];
    }

    // Get user IDs to fetch VIP tier information
    const userIds = activeBets.map((bet) => bet.userId);

    // Get VIP status for all users
    const vipStatuses = await this.dataSource
      .getRepository('UserVipStatusEntity')
      .createQueryBuilder('vip')
      .select(['vip.userId', 'vip.currentVipLevel'])
      .leftJoin('vip.currentBonusVipTier', 'tier')
      .addSelect(['tier.imageUrl'])
      .where('vip.userId IN (:...userIds)', { userIds })
      .getMany();

    // Create a map for quick lookup
    const vipLookup = new Map(
      vipStatuses.map((vip: any) => [vip.userId, vip.currentBonusVipTier?.imageUrl]),
    );

    const participants = activeBets.map((bet: any) => ({
      userId: bet.userId,
      username: bet.user?.username || 'Anonymous',
      vipLevelImageUrl: vipLookup.get(bet.userId),
      betAmount: bet.betAmount,
      asset: bet.asset,
      autoCashOutAt: bet.autoCashOutAt,
      status: bet.status,
    }));

    return participants;
  }

  /**
   * Get game leaderboard sorted by winnings for a specific crash game
   */
  async getGameLeaderboard(gameId: string): Promise<CrashLeaderboardEntry[]> {
    // Get all bets for this game (including crashed and cashed out bets)
    const gameBets = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'bet.userId',
        'bet.winAmount',
        'bet.betAmount',
        'bet.asset',
        'bet.autoCashOutAt',
        'bet.status',
        'bet.cashOutAt',
        'user.username',
        'user.isPrivate',
      ])
      .leftJoin('bet.user', 'user')
      .where('bet.crashGameId = :gameId', { gameId })
      .andWhere('bet.status IN (:...statuses)', {
        statuses: [CrashBetStatusEnum.CASHED_OUT, CrashBetStatusEnum.CRASHED],
      })
      .getMany();

    if (!gameBets.length) {
      return [];
    }

    // Get user IDs to fetch VIP tier information
    const userIds = gameBets.map((bet) => bet.userId);

    // Get VIP status for all users
    const vipStatuses = await this.dataSource
      .getRepository('UserVipStatusEntity')
      .createQueryBuilder('vip')
      .select(['vip.userId', 'vip.currentVipLevel'])
      .leftJoin('vip.currentBonusVipTier', 'tier')
      .addSelect(['tier.imageUrl'])
      .where('vip.userId IN (:...userIds)', { userIds })
      .getMany();

    // Create a map for quick VIP lookup
    const vipLookup = new Map(
      vipStatuses.map((vip: any) => [vip.userId, vip.currentBonusVipTier?.imageUrl]),
    );

    // Create leaderboard entries
    const leaderboardEntries = gameBets
      .map((bet: any) => ({
        userId: bet.userId,
        username: bet.user?.username || 'Anonymous',
        isPrivate: bet.user?.isPrivate || false,
        vipLevelImageUrl: vipLookup.get(bet.userId),
        cashOut: bet.winAmount || '0.00000000',
        asset: bet.asset as AssetTypeEnum,
        autoCashOutAt: bet.autoCashOutAt,
        cashOutAt: bet.cashOutAt, // Real multiplier when user cashed out (null for crashed players)
        // For sorting: convert winAmount to number for proper sorting
        winAmountNumeric: parseFloat(bet.winAmount || '0'),
      }))
      .sort((a, b) => b.winAmountNumeric - a.winAmountNumeric) // Sort by winnings descending
      .map((entry) => {
        // Remove winAmountNumeric and isPrivate but keep the other properties
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { winAmountNumeric, isPrivate, ...baseEntry } = entry;

        // Hide user info if private
        return isPrivate
          ? {
              ...baseEntry,
              username: undefined,
              vipLevelImageUrl: undefined,
            }
          : baseEntry;
      });

    return leaderboardEntries;
  }

  /**
   * Create a new crash game (thread-safe, single-process only)
   */
  private async createNewGame(): Promise<void> {
    await this.withLock(async () => {
      await this.performCreateNewGame();
    });
  }

  /**
   * Internal method to create a new crash game
   */
  private async performCreateNewGame(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get next seed from pre-generated chain
      const { serverSeed, gameIndex } = await this.getNextServerSeedFromChain();
      const serverSeedHash = this.hashServerSeed(serverSeed);
      const crashPoint = this.calculateCrashPoint(serverSeed);

      // Create new game
      const game = new CrashGameEntity();
      game.id = randomUUID();
      game.status = CrashGameStatusEnum.WAITING;

      // Store crash point with display precision (2 decimal places)
      // DB column is DECIMAL(12,2) => allows for much higher crash points from provably fair
      game.crashPoint = crashPoint.toFixed(2);
      game.serverSeed = serverSeed; // SECURITY: Internal only - never exposed via API
      game.serverSeedHash = serverSeedHash;
      game.nonce = gameIndex.toString(); // Game index serves as nonce
      game.gameIndex = gameIndex;

      this.currentGame = await queryRunner.manager.save(CrashGameEntity, game);

      await queryRunner.commitTransaction();

      this.logger.debug(
        `Created new crash game ${this.currentGame.id} | Index: ${gameIndex} | Crash: ${crashPoint.toFixed(2)}x`,
      );

      // Broadcast new game state
      this.crashWebSocketService.broadcastGameState({
        id: this.currentGame.id,
        status: this.currentGame.status,
        betsCount: 0,
        totalBetAmount: '0',
        serverSeedHash: this.currentGame.serverSeedHash,
        gameIndex: this.currentGame.gameIndex || 0,
      });

      // Start betting timer
      void this.scheduleBettingEnd();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to create new crash game:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get betting time - now hardcoded as game logic should not be configurable
   */
  private getBettingTime(): number {
    return this.BETTING_TIME;
  }

  /**
   * Schedule the end of betting period
   */
  private scheduleBettingEnd(): void {
    // Clear any existing timer
    if (this.gameTimer) {
      clearTimeout(this.gameTimer);
    }

    const bettingTime = this.getBettingTime();

    this.logger.debug(
      `Scheduling betting end in ${bettingTime}ms for game ${this.currentGame?.id}`,
    );

    this.gameTimer = setTimeout(() => {
      this.logger.debug(`Betting time ended, starting game ${this.currentGame?.id}`);
      void this.startGame();
    }, bettingTime);
  }

  /**
   * Start the crash game flight
   */
  private async startGame(): Promise<void> {
    if (!this.currentGame || this.currentGame.status !== CrashGameStatusEnum.WAITING) {
      return;
    }

    try {
      // Update game status
      this.currentGame.status = CrashGameStatusEnum.STARTING;
      this.currentGame.startedAt = new Date();
      await this.crashGameRepository.save(this.currentGame);

      this.logger.debug(`Starting crash game ${this.currentGame.id}`);

      // Broadcast STARTING status
      this.crashWebSocketService.broadcastGameState({
        id: this.currentGame.id,
        status: this.currentGame.status,
        betsCount: 0,
        totalBetAmount: '0',
        serverSeedHash: this.currentGame.serverSeedHash,
        gameIndex: this.currentGame.gameIndex || 0,
      });

      // Brief starting period
      setTimeout(() => {
        void this.flyGame();
      }, 2000);
    } catch (error) {
      this.logger.error(`Failed to start crash game ${this.currentGame?.id}:`, error);
    }
  }

  /**
   * Begin the flight phase
   */
  private async flyGame(): Promise<void> {
    if (!this.currentGame) {
      return;
    }

    try {
      // Update game status
      this.currentGame.status = CrashGameStatusEnum.FLYING;
      await this.crashGameRepository.save(this.currentGame);

      this.gameStartTime = Date.now();
      const crashPoint = parseFloat(this.currentGame.crashPoint);
      const crashTime = this.calculateCrashTime(crashPoint);

      this.logger.debug(
        `Crash game ${this.currentGame.id} is flying, will crash at ${crashPoint}x in ${crashTime}ms`,
      );

      // Get current game info with bet counts
      const currentGameInfo = await this.getCurrentGame();
      if (currentGameInfo) {
        // Broadcast FLYING status
        this.crashWebSocketService.broadcastGameState({
          id: currentGameInfo.id,
          status: currentGameInfo.status,
          betsCount: currentGameInfo.betsCount,
          totalBetAmount: currentGameInfo.totalBetAmount,
          serverSeedHash: currentGameInfo.serverSeedHash,
          gameIndex: currentGameInfo.gameIndex,
        });
      }

      // Schedule crash
      this.gameTimer = setTimeout(() => {
        void this.crashGame(this.currentGame!, crashPoint);
      }, crashTime);

      // Start real-time multiplier updates
      this.startMultiplierUpdates();

      // Handle auto cash-outs during flight
      void this.processAutoCashOuts();
    } catch (error) {
      this.logger.error(`Failed to fly crash game ${this.currentGame?.id}:`, error);
    }
  }

  /**
   * Process auto cash-outs during flight (includes max payout limits)
   */
  private async processAutoCashOuts(): Promise<void> {
    if (!this.currentGame || this.currentGame.status !== CrashGameStatusEnum.FLYING) {
      return;
    }

    try {
      // Get max payout limit from bet limits configuration
      const betLimits = await this.gameConfigService.getBetLimitsUsd(GameType.CRASH);
      const maxPayoutUsd = betLimits.maxPayoutUsd;

      // Get all active bets (need bet amount and asset for max payout calculation)
      const activeBets = await this.crashBetRepository
        .createQueryBuilder('bet')
        .select(['bet.id', 'bet.autoCashOutAt', 'bet.betAmount', 'bet.asset'])
        .where('bet.crashGameId = :gameId', { gameId: this.currentGame.id })
        .andWhere('bet.status = :status', { status: CrashBetStatusEnum.ACTIVE })
        .getMany();

      for (const bet of activeBets) {
        // Convert bet amount from crypto to USD
        const betAmountUsd = this.cryptoConverterService.convertToUsd(
          parseFloat(bet.betAmount),
          bet.asset,
        );
        if (betAmountUsd === null) {
          this.logger.warn(
            `Failed to convert bet amount to USD for bet ${bet.id}, skipping max payout check`,
          );
          continue;
        }

        const maxPayoutMultiplier = maxPayoutUsd / betAmountUsd;

        // Determine the effective auto cashout multiplier (min of user setting and max payout limit)
        let effectiveAutoCashOut: number | null = null;

        if (bet.autoCashOutAt) {
          const userAutoCashOut = parseFloat(bet.autoCashOutAt);
          effectiveAutoCashOut = Math.min(userAutoCashOut, maxPayoutMultiplier);
        } else {
          // No user auto cashout, but still enforce max payout limit
          effectiveAutoCashOut = maxPayoutMultiplier;
        }

        if (effectiveAutoCashOut && effectiveAutoCashOut > 1.0) {
          const crashTime = this.calculateCrashTime(effectiveAutoCashOut);
          const isMaxPayoutLimit =
            !bet.autoCashOutAt || effectiveAutoCashOut < parseFloat(bet.autoCashOutAt);

          setTimeout(() => {
            this.processAutoCashOut(bet.id, effectiveAutoCashOut, isMaxPayoutLimit).catch(
              (error) => {
                this.logger.error(`Failed to process auto cash-out for bet ${bet.id}:`, error);
              },
            );
          }, crashTime);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process auto cash-outs:', error);
    }
  }

  /**
   * Process individual auto cash-out
   */
  private async processAutoCashOut(
    betId: string,
    multiplier: number,
    isMaxPayoutLimit: boolean = false,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const bet = await queryRunner.manager.findOne(CrashBetEntity, {
        where: {
          id: betId,
          status: CrashBetStatusEnum.ACTIVE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!bet || !this.currentGame || this.currentGame.status !== CrashGameStatusEnum.FLYING) {
        await queryRunner.rollbackTransaction();
        return;
      }

      // Calculate win amount
      const betAmount = new BigNumber(bet.betAmount);
      const winAmount = betAmount.multipliedBy(multiplier).decimalPlaces(8, BigNumber.ROUND_DOWN);

      // Update bet
      bet.status = CrashBetStatusEnum.CASHED_OUT;
      bet.cashOutAt = multiplier.toFixed(2);
      bet.winAmount = winAmount.toFixed(8);
      bet.cashOutTime = new Date();

      await queryRunner.manager.save(CrashBetEntity, bet);

      // Credit win amount in crypto
      const winResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.WIN,
        operationId: randomUUID(),
        userId: bet.userId,
        amount: winAmount,
        asset: bet.asset,
        description: 'Crash win',
        metadata: { betId: bet.id },
      });

      if (!winResult.success) {
        throw new Error(`Failed to credit auto cash-out: ${winResult.error}`);
      }

      // Update user_bets table with final payout
      this.logger.debug(
        `Creating user_bets for auto cash out: bet ${betId}, ${multiplier.toFixed(2)}x, win ${winAmount.toFixed(8)}`,
      );

      await this.userBetService.createUserBet({
        game: GameTypeEnum.CRASH,
        betId: bet.id,
        userId: bet.userId,
        betAmount: bet.betAmount,
        asset: bet.asset,
        multiplier: multiplier.toFixed(2),
        payout: winAmount.toFixed(8),
        // Include fiat preservation data
        originalFiatAmount: bet.originalFiatAmount,
        originalFiatCurrency: safeCurrencyConversion(bet.originalFiatCurrency),
        fiatToUsdRate: bet.fiatToUsdRate,
      });

      await queryRunner.commitTransaction();

      const cashoutReason = isMaxPayoutLimit ? 'max payout limit' : 'user auto cashout';
      this.logger.debug(
        `Auto cashed out bet ${betId} at ${multiplier.toFixed(2)}x (${cashoutReason})`,
      );

      // Broadcast auto cash out event
      this.crashWebSocketService.broadcastCashOut({
        gameId: this.currentGame.id,
        userId: bet.userId,
        betId: bet.id,
        multiplier: multiplier.toFixed(2),
        winAmount: winAmount.toFixed(8),
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process auto cash-out for bet ${betId}:`, error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crash the game
   */
  private async crashGame(game: CrashGameEntity, crashPoint: number): Promise<void> {
    try {
      // Update game status
      game.status = CrashGameStatusEnum.CRASHED;
      game.crashedAt = new Date();
      await this.crashGameRepository.save(game);

      this.logger.debug(`Crash game ${game.id} crashed at ${crashPoint}x`);

      // Get all bets for this game first
      const allGameBets = await this.crashBetRepository.find({
        where: { crashGameId: game.id },
        select: ['id', 'userId', 'status', 'cashOutAt', 'betAmount', 'asset'],
        order: { createdAt: 'ASC' },
      });

      // Get list of users who participated in this game
      const participatingUserIds = new Set(allGameBets.map((bet) => bet.userId));

      // Send user-specific crash events for users who participated in this game
      // Processing game bets

      if (allGameBets.length === 0) {
        this.logger.warn(
          `🚨 CRASH DEBUG: No bets found for game ${game.id}! All users will get general broadcast.`,
        );
      }

      for (const bet of allGameBets) {
        const isUserBetWin = bet.status === CrashBetStatusEnum.CASHED_OUT;

        // Processing user bet

        const userSpecificData = {
          id: game.id,
          status: game.status,
          crashPoint: game.crashPoint,
          serverSeedHash: game.serverSeedHash,
          nonce: game.nonce,
          crashedAt: (game.crashedAt || new Date()).toISOString(),
          isUserBetWin,
          betId: bet.id,
          cashOutAt: isUserBetWin ? bet.cashOutAt : undefined,
        };

        // Sending user-specific crash event

        void this.crashWebSocketService
          .sendToUser(bet.userId, 'crash:game_crashed', userSpecificData)
          .catch((error) => {
            this.logger.error(
              `❌ CRASH DEBUG: Failed to send user-specific crash event to ${bet.userId}:`,
              error,
            );
          });
      }

      // Broadcast general game crashed event to all users who didn't participate
      void this.crashWebSocketService.broadcastGameCrashedExcludeUsers(
        {
          id: game.id,
          status: game.status,
          crashPoint: game.crashPoint,
          serverSeedHash: game.serverSeedHash,
          gameIndex: game.gameIndex!,
          crashedAt: (game.crashedAt || new Date()).toISOString(),
        },
        participatingUserIds,
      );

      // Get all active bets before updating them
      const activeBets = allGameBets.filter((b) => b.status === CrashBetStatusEnum.ACTIVE);

      // Mark remaining active bets as crashed
      await this.crashBetRepository.update(
        {
          crashGameId: game.id,
          status: CrashBetStatusEnum.ACTIVE,
        },
        {
          status: CrashBetStatusEnum.CRASHED,
        },
      );

      // Update user_bets table for crashed (losing) bets
      for (const bet of activeBets) {
        await this.userBetService.createUserBet({
          game: GameTypeEnum.CRASH,
          betId: bet.id,
          userId: bet.userId,
          betAmount: bet.betAmount,
          asset: bet.asset,
          multiplier: '0.00', // Multiplier is 0 for losses
          payout: '0.00000000', // Payout is 0 - player receives nothing for losses
          // Include fiat preservation data
          originalFiatAmount: bet.originalFiatAmount,
          originalFiatCurrency: safeCurrencyConversion(bet.originalFiatCurrency),
          fiatToUsdRate: bet.fiatToUsdRate,
        });

        this.logger.debug(`Created user_bets record for crashed bet ${bet.id}`, {
          betId: bet.id,
          userId: bet.userId,
          multiplier: '0.00',
          payout: '0.00000000',
        });
      }

      // End game after brief delay
      setTimeout(() => {
        void this.endGame(game);
      }, 3000);
    } catch (error) {
      this.logger.error(`Failed to crash game ${game.id}:`, error);
    }
  }

  /**
   * End the game and prepare for next round
   */
  private async endGame(game: CrashGameEntity): Promise<void> {
    try {
      // Calculate game statistics
      const gameStats = await this.calculateGameStats(game.id);

      // Update game with final stats
      game.status = CrashGameStatusEnum.ENDED;
      game.endedAt = new Date();
      game.gameData = gameStats;
      await this.crashGameRepository.save(game);

      this.logger.debug(
        `Ended crash game ${game.id}: ${gameStats.totalBets} bets, ${gameStats.totalBetAmount} total bet, ${gameStats.playerCount} players, max ${gameStats.maxMultiplier}x`,
      );

      // Clear current game
      this.currentGame = null;
      if (this.gameTimer) {
        clearTimeout(this.gameTimer);
        this.gameTimer = null;
      }

      // Start new game after shorter delay for better UX
      setTimeout(() => {
        void this.createNewGame();
      }, 2000);
    } catch (error) {
      this.logger.error(`Failed to end game ${game.id}:`, error);
    }
  }

  /**
   * Calculate game statistics
   */
  private async calculateGameStats(gameId: string) {
    const result = await this.crashBetRepository
      .createQueryBuilder('bet')
      .select([
        'COUNT(*) as "totalBets"',
        'SUM(CAST(bet.betAmount AS DECIMAL)) as "totalBetAmount"',
        'SUM(CASE WHEN bet.winAmount IS NOT NULL THEN CAST(bet.winAmount AS DECIMAL) ELSE 0 END) as "totalWinAmount"',
        'MAX(CASE WHEN bet.cashOutAt IS NOT NULL THEN CAST(bet.cashOutAt AS DECIMAL) ELSE 0 END) as "maxMultiplier"',
        'COUNT(DISTINCT bet.userId) as "playerCount"',
        'COUNT(DISTINCT CASE WHEN bet.status = :cashedOutStatus OR (bet.winAmount IS NOT NULL AND CAST(bet.winAmount AS DECIMAL) > 0) THEN bet.userId END) as "cashedOutPlayerCount"',
      ])
      .where('bet.crashGameId = :gameId', { gameId })
      .setParameter('cashedOutStatus', CrashBetStatusEnum.CASHED_OUT)
      .getRawOne<{
        totalBets: string;
        totalBetAmount: string | null;
        totalWinAmount: string | null;
        maxMultiplier: string | null;
        playerCount: string;
        cashedOutPlayerCount: string;
      }>();

    return {
      totalBets: parseInt(result?.totalBets || '0') || 0,
      totalBetAmount: result?.totalBetAmount || '0',
      totalWinAmount: result?.totalWinAmount || '0',
      maxMultiplier: result?.maxMultiplier || '0',
      playerCount: parseInt(result?.playerCount || '0') || 0,
      cashedOutPlayerCount: parseInt(result?.cashedOutPlayerCount || '0') || 0,
    };
  }

  /**
   * Get last 10 crashed games (global history)
   * If userId is provided, returns user-specific data (isUserBetWin, user's betId)
   */
  async getLastCrashedGames(userId?: string) {
    // Return last 10 games that have crashed (include both CRASHED and ENDED statuses)
    const games = await this.crashGameRepository
      .createQueryBuilder('game')
      .where('game.crashedAt IS NOT NULL')
      .orderBy('game.crashedAt', 'DESC')
      .limit(10)
      .getMany();

    // For each game, return compact details
    const results = await Promise.all(
      games.map(async (game) => {
        if (userId) {
          // User-specific data: check if user participated and won
          const userBet = await this.crashBetRepository.findOne({
            where: { crashGameId: game.id, userId },
            select: ['id', 'status', 'cashOutAt'],
          });

          if (userBet) {
            // User participated in this game
            const isUserBetWin = userBet.status === CrashBetStatusEnum.CASHED_OUT;
            return {
              id: game.id,
              status: game.status,
              crashPoint: game.crashPoint,
              serverSeedHash: game.serverSeedHash,
              nonce: game.nonce,
              crashedAt: game.crashedAt,
              isUserBetWin,
              betId: userBet.id,
              cashOutAt: isUserBetWin ? userBet.cashOutAt : undefined,
            };
          } else {
            // User didn't participate, return general game info only
            return {
              id: game.id,
              status: game.status,
              crashPoint: game.crashPoint,
              serverSeedHash: game.serverSeedHash,
              nonce: game.nonce,
              crashedAt: game.crashedAt,
            };
          }
        } else {
          // No user context: return general game info only
          return {
            id: game.id,
            status: game.status,
            crashPoint: game.crashPoint,
            serverSeedHash: game.serverSeedHash,
            nonce: game.nonce,
            crashedAt: game.crashedAt,
          };
        }
      }),
    );
    return results;
  }

  /**
   * Get crash game details by game ID
   */
  async getGameDetails(gameId: string, userId?: string): Promise<CrashGameDetailsResponseDto> {
    const game = await this.crashGameRepository.findOne({
      where: { id: gameId },
      select: ['id', 'status', 'crashPoint', 'serverSeedHash', 'nonce', 'crashedAt'],
    });

    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const gameStats = await this.calculateGameStats(gameId);

    const result = new CrashGameDetailsResponseDto();
    result.id = game.id;
    result.status = game.status;
    result.crashPoint = game.crashPoint;
    result.serverSeedHash = game.serverSeedHash;
    result.nonce = game.nonce;
    result.crashedAt = game.crashedAt;
    result.totalPlayers = gameStats.playerCount;
    result.cashedOutPlayers = gameStats.cashedOutPlayerCount;

    if (userId) {
      this.logger.debug(`Looking for user bet: gameId=${gameId}, userId=${userId}`);
      const userBetEntity = await this.crashBetRepository.findOne({
        where: { crashGameId: gameId, userId },
      });
      this.logger.debug(`Found user bet: ${userBetEntity ? 'YES' : 'NO'}`);
      if (userBetEntity) {
        // Calculate user bet details
        const betAmount = userBetEntity.betAmount;
        let multiplier = '0.00';
        if (userBetEntity.status === CrashBetStatusEnum.CASHED_OUT && userBetEntity.cashOutAt) {
          multiplier = parseFloat(userBetEntity.cashOutAt).toFixed(2);
        } else if (userBetEntity.status === CrashBetStatusEnum.CRASHED) {
          multiplier = '0.00';
        } else if (userBetEntity.cashOutAt) {
          multiplier = parseFloat(userBetEntity.cashOutAt).toFixed(2);
        }
        let payout = '0.00000000';
        if (userBetEntity.status === CrashBetStatusEnum.CASHED_OUT) {
          payout = userBetEntity.winAmount || '0.00000000';
        }
        const userBet: IUserBet = {
          asset: userBetEntity.asset,
          betAmount,
          multiplier,
          payout,
          status: userBetEntity.status,
        };
        result.userBet = userBet;
      }
    }

    return result;
  }

  /**
   * Get the next server seed from the pre-generated seed chain
   * Thread-safe with database transaction locks
   * CRITICAL SECURITY: Only accessible internally by game engine - NEVER expose seeds via API
   */
  private async getNextServerSeedFromChain(): Promise<{
    serverSeed: string;
    gameIndex: number;
  }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get current index with pessimistic lock
      const gameState = await queryRunner.manager
        .createQueryBuilder(CrashGameStateEntity, 'state')
        .where('state.id = 1')
        .setLock('pessimistic_write')
        .getOne();

      if (!gameState) {
        throw new Error('Crash game state not initialized. Run setup first.');
      }

      const currentIndex = gameState.currentGameIndex;

      if (currentIndex > CRASH_CONSTANTS.CHAIN_LENGTH) {
        throw new Error(
          `Seed chain exhausted. No more games available (current index: ${currentIndex}, max: ${CRASH_CONSTANTS.CHAIN_LENGTH})`,
        );
      }

      // Get seed for this index
      const seedEntity = await queryRunner.manager.findOne(CrashSeedEntity, {
        where: { gameIndex: currentIndex },
      });

      if (!seedEntity) {
        throw new Error(`Seed not found for game index ${currentIndex}`);
      }

      // Update to next index (counting up from 1 to 10M)
      gameState.currentGameIndex = currentIndex + 1;
      gameState.lastUpdated = new Date();

      await queryRunner.manager.save(CrashGameStateEntity, gameState);
      await queryRunner.commitTransaction();

      this.logger.debug(
        `Retrieved seed for game index ${currentIndex}. Next index: ${currentIndex + 1}`,
      );

      return {
        serverSeed: seedEntity.serverSeed,
        gameIndex: currentIndex,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to get next server seed from chain:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Hash server seed for public display
   */
  private hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Public method to verify crash game outcome (provably fair)
   * Uses Stake's algorithm with Bitcoin block hash as client seed
   */
  verifyCrashOutcome(
    serverSeed: string,
    gameIndex: number,
    providedCrashPoint?: number,
  ): {
    isValid: boolean;
    calculatedCrashPoint: number;
    providedCrashPoint?: number;
    serverSeed: string;
    gameIndex: number;
    bitcoinBlockHash: string;
    terminatingHash: string;
    hash: string;
  } {
    try {
      // Validate constants are available
      validateCrashConstants();

      // Calculate crash point using the exact same algorithm as game generation
      const calculatedCrashPoint = this.calculateCrashPoint(serverSeed);

      // Generate the hash for reference
      const hash = crypto
        .createHmac(CRASH_CONSTANTS.HASH_ALGORITHM, serverSeed)
        .update(CRASH_CONSTANTS.BITCOIN_BLOCK_HASH)
        .digest('hex');

      // Check if the calculated crash point matches the provided one (if provided)
      let isValid = true;
      if (providedCrashPoint !== undefined) {
        const tolerance = 0.00000001; // 8 decimal places precision
        isValid = Math.abs(calculatedCrashPoint - providedCrashPoint) < tolerance;
      }

      // Optionally verify seed is part of chain (expensive operation)
      const seedInChain = this.verifySeedInChain(serverSeed, gameIndex);
      if (!seedInChain) {
        this.logger.warn(`Seed verification failed for game index ${gameIndex}`);
      }

      return {
        isValid,
        calculatedCrashPoint: parseFloat(calculatedCrashPoint.toFixed(2)),
        providedCrashPoint: providedCrashPoint
          ? parseFloat(providedCrashPoint.toFixed(2))
          : undefined,
        serverSeed,
        gameIndex,
        bitcoinBlockHash: CRASH_CONSTANTS.BITCOIN_BLOCK_HASH,
        terminatingHash: CRASH_CONSTANTS.TERMINATING_HASH,
        hash,
      };
    } catch (error) {
      this.logger.error('Failed to verify crash outcome:', error);
      throw new BadRequestException('Failed to verify crash game outcome');
    }
  }

  /**
   * Verify a seed belongs to our pre-generated chain
   * This is an expensive operation - only use for critical verification
   * SECURITY: Does NOT expose actual seeds - only validates chain integrity
   */
  private verifySeedInChain(seed: string, gameIndex: number): boolean {
    try {
      // Hash forward from this seed to the final seed
      let currentSeed = seed;

      for (let i = gameIndex; i < CRASH_CONSTANTS.CHAIN_LENGTH; i++) {
        currentSeed = crypto.createHash('sha256').update(currentSeed).digest('hex');
      }

      // The final hash should match our terminating hash
      const finalHash = crypto.createHash('sha256').update(currentSeed).digest('hex');

      return finalHash === CRASH_CONSTANTS.TERMINATING_HASH;
    } catch (error) {
      this.logger.error('Failed to verify seed in chain:', error);
      return false;
    }
  }

  /**
   * Calculate current multiplier based on elapsed time
   * Uses configurable constants to match frontend graph display
   */
  private calculateCurrentMultiplier(elapsedTimeMs: number): number {
    // Multiplier grows exponentially using configurable formula
    // Formula: multiplier = 1.0 + (timeInSeconds^EXPONENT) * COEFFICIENT
    const timeInSeconds = elapsedTimeMs / 1000;
    const multiplier =
      1.0 +
      Math.pow(timeInSeconds, CRASH_CONSTANTS.CRASH_FORMULA_EXPONENT) *
        CRASH_CONSTANTS.CRASH_FORMULA_COEFFICIENT;
    return Math.max(1.0, multiplier);
  }

  /**
   * Calculate time when crash should occur for given multiplier
   * Uses configurable constants to match frontend calculations
   */
  private calculateCrashTime(crashPoint: number): number {
    if (crashPoint <= 1.0) {
      return 0;
    }

    // Inverse of multiplier calculation using configurable constants
    // Formula: time = ((crashPoint - 1) / COEFFICIENT)^(1/EXPONENT) * 1000
    const timeInSeconds = Math.pow(
      (crashPoint - 1.0) / CRASH_CONSTANTS.CRASH_FORMULA_COEFFICIENT,
      1.0 / CRASH_CONSTANTS.CRASH_FORMULA_EXPONENT,
    );
    return Math.max(0, timeInSeconds * 1000);
  }

  /**
   * Periodic cleanup of old games (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldGames(): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7); // Keep 7 days of history

      // First find games to delete
      const gamesToDelete = await queryRunner.manager
        .createQueryBuilder(CrashGameEntity, 'game')
        .select('game.id')
        .where('game.status = :status', { status: CrashGameStatusEnum.ENDED })
        .andWhere('game.endedAt < :cutoffDate', { cutoffDate })
        .getMany();

      if (gamesToDelete.length === 0) {
        await queryRunner.commitTransaction();
        return;
      }

      const gameIds = gamesToDelete.map((game) => game.id);

      // Delete crash bets first
      const deletedBets = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(CrashBetEntity)
        .where('crashGameId IN (:...gameIds)', { gameIds })
        .execute();

      // Then delete games
      const deletedGames = await queryRunner.manager
        .createQueryBuilder()
        .delete()
        .from(CrashGameEntity)
        .where('id IN (:...gameIds)', { gameIds })
        .execute();

      await queryRunner.commitTransaction();

      if (deletedGames.affected && deletedGames.affected > 0) {
        this.logger.log(
          `Cleaned up ${deletedGames.affected} old crash games and ${deletedBets.affected || 0} related bets`,
        );
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to cleanup old crash games:', error);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get primary wallet balance (crypto) for a user
   */
  async getPrimaryWalletBalance(userId: string): Promise<{ balance: string; asset: string }> {
    const primaryWallet = await this.balanceService.getPrimaryWallet(userId);
    if (!primaryWallet) {
      throw new BadRequestException('No primary wallet found');
    }
    return { balance: primaryWallet.balance, asset: primaryWallet.asset };
  }

  async getUserBetById(betId: string): Promise<any> {
    return await this.userBetService.getUserBetById(GameTypeEnum.CRASH, betId);
  }

  /**
   * Get bet details by bet ID
   */
  async getBetById(betId: string, requestingUserId?: string): Promise<CrashBetDetailsResponseDto> {
    // Find the crash bet
    const bet = await this.crashBetRepository.findOne({
      where: { id: betId },
      relations: ['crashGame', 'user'],
    });

    if (!bet) {
      throw new NotFoundException('Bet not found');
    }

    // Phase 1: Check if requesting user is the bet owner
    const isOwner = requestingUserId === bet.userId;

    // Get game statistics
    const gameStats = await this.calculateGameStats(bet.crashGameId);

    // Get user VIP status for level image
    const vipStatuses = await this.userVipStatusService.getUsersVipStatus([bet.userId]);
    const userVipStatus = vipStatuses.find((status) => status.userId === bet.userId);

    // Phase 1: Only fetch fiat preservation data if owner
    let userBet: any;
    if (isOwner) {
      userBet = await this.userBetService.getUserBetById(GameTypeEnum.CRASH, betId);
    }

    // Calculate multiplier and payout from crash bet data
    let multiplier: string;
    let payout: string;
    let payoutFiatAmount: string | undefined;
    let payoutFiatCurrency: any;

    if (bet.status === CrashBetStatusEnum.CASHED_OUT && bet.cashOutAt) {
      // If cashed out, use the cash out multiplier
      multiplier = parseFloat(bet.cashOutAt).toFixed(2);
      payout = bet.winAmount || '0.00000000';

      // Calculate fiat payout if fiat data exists
      if (userBet?.originalFiatAmount && userBet.originalFiatCurrency) {
        const fiatBetAmount = new BigNumber(userBet.originalFiatAmount);
        const multiplierBN = new BigNumber(multiplier);
        const calculatedPayoutFiat = fiatBetAmount.multipliedBy(multiplierBN);
        payoutFiatAmount = calculatedPayoutFiat.decimalPlaces(2, BigNumber.ROUND_DOWN).toString();
        payoutFiatCurrency = safeCurrencyConversion(userBet.originalFiatCurrency);
      }
    } else if (bet.status === CrashBetStatusEnum.CRASHED) {
      // If crashed, multiplier is 0 and payout is 0 (bet details show $0, not negative)
      multiplier = '0.00';
      payout = '0.00000000';

      // For losses, fiat payout is also 0
      if (userBet?.originalFiatAmount && userBet.originalFiatCurrency) {
        payoutFiatAmount = '0.00';
        payoutFiatCurrency = safeCurrencyConversion(userBet.originalFiatCurrency);
      }
    } else {
      // For active bets or other statuses
      multiplier = '0.00';
      payout = bet.winAmount || '0.00000000';

      // For pending bets, no fiat payout calculation
      if (userBet?.originalFiatAmount && userBet.originalFiatCurrency) {
        payoutFiatAmount = '0.00';
        payoutFiatCurrency = safeCurrencyConversion(userBet.originalFiatCurrency);
      }
    }

    // Base response without fiat preservation data
    const baseResult: CrashBetDetailsResponseDto = {
      id: bet.id,
      gameId: bet.crashGameId,
      userId: bet.userId,
      user: bet.user?.isPrivate
        ? null
        : {
            id: bet.user.id,
            userName: bet.user.displayName || bet.user.username,
            levelImageUrl: userVipStatus?.vipLevelImage || '',
          },
      asset: bet.asset,
      betAmount: bet.betAmount,
      autoCashOutAt: bet.autoCashOutAt,
      status: bet.status,
      cashOutAt: bet.cashOutAt,
      winAmount: bet.winAmount,
      cashOutTime: bet.cashOutTime,
      crashPoint: bet.crashGame.crashPoint,
      multiplier: multiplier,
      payout: payout,
      totalPlayers: gameStats.playerCount || 1, // Default to 1 if no stats
      cashedOutPlayers: gameStats.cashedOutPlayerCount || 0,
      totalBetAmount: gameStats.totalBetAmount,
      totalWinAmount: gameStats.totalWinAmount,
      serverSeedHash: bet.crashGame.serverSeed, // Server seed generates each time the game is started, at the end of the game we can send it to the client for provably fair verification
      gameIndex: bet.crashGame.gameIndex || 0,
      createdAt: bet.createdAt,
      leaderboard: await this.getGameLeaderboard(bet.crashGameId),
    };

    // Phase 1: Only include fiat preservation data for bet owner's personal records
    if (isOwner) {
      return {
        ...baseResult,
        originalFiatAmount: userBet?.originalFiatAmount,
        originalFiatCurrency: userBet?.originalFiatCurrency,
        fiatToUsdRate: userBet?.fiatToUsdRate,
        payoutFiatAmount,
        payoutFiatCurrency,
      };
    }

    return baseResult;
  }

  // Testing helper - force next crash point for development
  private nextCrashPointOverride: number | null = null;

  /**
   * Set next crash point for testing purposes (dev only)
   */
  setNextCrashPointForTesting(
    crashPoint: number,
    userId: string,
  ): { success: boolean; nextCrashPoint: string } {
    // Basic validation
    if (crashPoint < 1.0 || crashPoint > 1000) {
      throw new BadRequestException('Crash point must be between 1.0 and 1000');
    }

    this.nextCrashPointOverride = crashPoint;
    this.logger.log(`User ${userId} set next crash point override to ${crashPoint}x for testing`);

    return {
      success: true,
      nextCrashPoint: crashPoint.toFixed(2),
    };
  }

  /**
   * Calculate crash point using Stake's algorithm with Bitcoin block hash as client seed
   * Formula: Math.max(1, (2^32 / (hash_int + 1)) * 0.99) for exactly 1% house edge
   * Uses SHA-256 HMAC combining server seed and Bitcoin block hash
   */
  private calculateCrashPoint(serverSeed: string): number {
    // Check for testing override first
    if (this.nextCrashPointOverride !== null) {
      const overrideValue = this.nextCrashPointOverride;
      this.nextCrashPointOverride = null; // Use once and reset
      this.logger.log(`Using testing crash point override: ${overrideValue}x`);
      return overrideValue;
    }

    // Validate constants are set
    if (!CRASH_CONSTANTS.BITCOIN_BLOCK_HASH) {
      throw new Error(
        'Bitcoin block hash not set. Cannot calculate crash point until block is mined.',
      );
    }

    // Stake's algorithm: SHA-256 HMAC with server seed and Bitcoin block hash
    const hash = crypto
      .createHmac(CRASH_CONSTANTS.HASH_ALGORITHM, serverSeed)
      .update(CRASH_CONSTANTS.BITCOIN_BLOCK_HASH)
      .digest('hex');

    // Take first 32 bits of hash
    const hashInt = parseInt(hash.substring(0, 8), 16);

    // Stake's formula: exactly 1% house edge
    const crashPoint = Math.max(
      1.0,
      (Math.pow(2, 32) / (hashInt + 1)) * (1 - CRASH_CONSTANTS.HOUSE_EDGE),
    );

    return crashPoint;
  }

  async getFinishedGameSeed(
    gameId: string,
  ): Promise<{ serverSeed: string; serverSeedHash: string; gameIndex?: number }> {
    const game = await this.crashGameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException('Game not found');
    }
    if (game.status !== CrashGameStatusEnum.ENDED) {
      throw new BadRequestException('Game not finished');
    }
    return {
      serverSeed: game.serverSeed,
      serverSeedHash: game.serverSeedHash,
      gameIndex: game.gameIndex,
    };
  }
}
