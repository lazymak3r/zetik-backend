import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  GameResultEntity,
  GameSessionEntity,
  GameStatusEnum,
  GameTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { ProvablyFairService } from './provably-fair.service';

export interface CreateGameSessionDto {
  userId: string;
  gameType: GameTypeEnum;
  asset: AssetTypeEnum;
  betAmount: string;
  gameConfig?: Record<string, any>;
}

export interface GameSessionResult {
  sessionId: string;
  outcome: any;
  isWin: boolean;
  winAmount?: string;
  multiplier?: string;
}

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);

  constructor(
    @InjectRepository(GameSessionEntity)
    private readonly gameSessionRepository: Repository<GameSessionEntity>,
    private readonly provablyFairService: ProvablyFairService,
    private readonly balanceService: BalanceService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new game session and place bet
   */
  async createGameSession(dto: CreateGameSessionDto): Promise<GameSessionEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Creating game session for user ${dto.userId}`, {
        gameType: dto.gameType,
        betAmount: dto.betAmount,
        asset: dto.asset,
      });

      // Validate bet amount
      this.validateBetAmount(dto.betAmount);

      // Get seed pair for provably fair
      const seedPair = await this.provablyFairService.getActiveSeedPair(dto.userId);
      if (!seedPair) {
        // Generate initial seed pair if none exists
        await this.provablyFairService.generateSeedPair(dto.userId);
        const newSeedPair = await this.provablyFairService.getActiveSeedPair(dto.userId);
        if (!newSeedPair) {
          throw new Error('Failed to generate seed pair');
        }
      }

      // Deduct bet amount from user balance
      const betResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: randomUUID(),
        userId: dto.userId,
        amount: new BigNumber(dto.betAmount),
        asset: dto.asset,
        description: `${dto.gameType} game bet`,
      });

      if (!betResult.success) {
        throw new BadRequestException(
          betResult.error || ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE,
        );
      }

      // Create game session
      const gameSession = new GameSessionEntity();
      gameSession.id = randomUUID();
      gameSession.userId = dto.userId;
      gameSession.gameType = dto.gameType;
      gameSession.status = GameStatusEnum.ACTIVE;
      gameSession.asset = dto.asset;
      gameSession.betAmount = dto.betAmount;
      gameSession.serverSeed = seedPair!.serverSeed;
      gameSession.clientSeed = seedPair!.clientSeed;
      gameSession.nonce = (BigInt(seedPair!.nonce) + 1n).toString();
      gameSession.gameConfig = dto.gameConfig || {};
      gameSession.gameState = {};

      const savedSession = await queryRunner.manager.save(GameSessionEntity, gameSession);

      await queryRunner.commitTransaction();

      this.logger.log(`Game session created successfully`, {
        sessionId: savedSession.id,
        userId: dto.userId,
        gameType: dto.gameType,
      });

      return savedSession;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create game session for user ${dto.userId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Complete a game session with outcome
   */
  async completeGameSession(
    sessionId: string,
    outcome: Record<string, any>,
    isWin: boolean,
    multiplier?: number,
  ): Promise<GameSessionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Completing game session ${sessionId}`, {
        isWin,
        multiplier,
      });

      // Get game session with lock
      const gameSession = await queryRunner.manager.findOne(GameSessionEntity, {
        where: { id: sessionId, status: GameStatusEnum.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });

      if (!gameSession) {
        throw new BadRequestException('Game session not found or already completed');
      }

      // Generate provably fair outcome
      const provablyFairOutcome = await this.provablyFairService.generateGameOutcome(
        gameSession.userId,
        gameSession.gameType,
        gameSession.betAmount,
      );

      // Calculate win amount
      let winAmount = '0';
      if (isWin && multiplier) {
        const betAmountNum = parseFloat(gameSession.betAmount);
        winAmount = (betAmountNum * multiplier).toFixed(8);

        // Credit win amount to user balance
        const winResult = await this.balanceService.updateBalance({
          operation: BalanceOperationEnum.WIN,
          operationId: randomUUID(),
          userId: gameSession.userId,
          amount: new BigNumber(winAmount),
          asset: gameSession.asset,
          description: `${gameSession.gameType} game win`,
        });

        if (!winResult.success) {
          throw new Error(`Failed to credit win amount: ${winResult.error}`);
        }
      }

      // Update game session
      gameSession.status = GameStatusEnum.COMPLETED;
      gameSession.result = outcome;
      gameSession.winAmount = winAmount;
      gameSession.completedAt = new Date();

      // Create game result record
      const gameResult = new GameResultEntity();
      gameResult.id = randomUUID();
      gameResult.gameSessionId = sessionId;
      gameResult.userId = gameSession.userId;
      gameResult.outcomeData = outcome;
      gameResult.outcomeValue = provablyFairOutcome.value.toString();
      gameResult.verificationHash = provablyFairOutcome.hash;
      gameResult.isWin = isWin;
      gameResult.multiplier = multiplier?.toString();

      await queryRunner.manager.save(GameSessionEntity, gameSession);
      await queryRunner.manager.save(GameResultEntity, gameResult);

      await queryRunner.commitTransaction();

      this.logger.log(`Game session completed successfully`, {
        sessionId,
        userId: gameSession.userId,
        isWin,
        winAmount,
        multiplier,
      });

      return {
        sessionId,
        outcome: {
          ...outcome,
          provablyFair: {
            value: provablyFairOutcome.value,
            hash: provablyFairOutcome.hash,
            nonce: provablyFairOutcome.nonce,
          },
        },
        isWin,
        winAmount: isWin ? winAmount : undefined,
        multiplier: multiplier?.toString(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to complete game session ${sessionId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Cancel an active game session and refund bet
   */
  async cancelGameSession(sessionId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get game session with lock
      const gameSession = await queryRunner.manager.findOne(GameSessionEntity, {
        where: { id: sessionId, status: GameStatusEnum.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });

      if (!gameSession) {
        throw new BadRequestException('Game session not found or already completed');
      }

      // Refund bet amount
      const refundResult = await this.balanceService.updateBalance({
        operation: BalanceOperationEnum.REFUND,
        operationId: randomUUID(),
        userId: gameSession.userId,
        amount: new BigNumber(gameSession.betAmount),
        asset: gameSession.asset,
        description: `${gameSession.gameType} game refund`,
      });

      if (!refundResult.success) {
        throw new Error(`Failed to refund bet amount: ${refundResult.error}`);
      }

      // Update game session status
      gameSession.status = GameStatusEnum.CANCELLED;
      gameSession.completedAt = new Date();

      await queryRunner.manager.save(GameSessionEntity, gameSession);

      await queryRunner.commitTransaction();

      this.logger.log(`Game session cancelled and refunded`, {
        sessionId,
        userId: gameSession.userId,
        refundAmount: gameSession.betAmount,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to cancel game session ${sessionId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get game session by ID
   */
  async getGameSession(sessionId: string): Promise<GameSessionEntity | null> {
    return this.gameSessionRepository.findOne({
      where: { id: sessionId },
      relations: ['user', 'gameResults'],
    });
  }

  /**
   * Get user's game history (optimized with proper indexing)
   */
  async getUserGameHistory(
    userId: string,
    gameType?: GameTypeEnum,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ sessions: GameSessionEntity[]; total: number }> {
    const queryBuilder = this.gameSessionRepository
      .createQueryBuilder('session')
      .select([
        'session.id',
        'session.gameType',
        'session.status',
        'session.asset',
        'session.betAmount',
        'session.winAmount',
        'session.createdAt',
        'session.completedAt',
      ])
      .where('session.userId = :userId', { userId });

    if (gameType) {
      queryBuilder.andWhere('session.gameType = :gameType', { gameType });
    }

    // Use optimized ordering for index utilization
    queryBuilder.orderBy('session.createdAt', 'DESC');

    const [sessions, total] = await queryBuilder.skip(offset).take(limit).getManyAndCount();

    return { sessions, total };
  }

  /**
   * Get current active session for a user
   */
  async getCurrentSession(userId: string): Promise<GameSessionEntity | null> {
    return this.gameSessionRepository.findOne({
      where: {
        userId,
        status: GameStatusEnum.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Recover an interrupted game session
   */
  async recoverGameSession(sessionId: string, userId: string): Promise<GameSessionEntity | null> {
    const session = await this.gameSessionRepository.findOne({
      where: {
        id: sessionId,
        userId,
        status: GameStatusEnum.ACTIVE,
      },
      relations: ['gameResults'],
    });

    if (!session) {
      this.logger.warn(`No recoverable session found`, { sessionId, userId });
      return null;
    }

    // Check if session is too old (older than 24 hours)
    const sessionAge = Date.now() - session.createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (sessionAge > maxAge) {
      this.logger.warn(`Session too old for recovery, auto-cancelling`, {
        sessionId,
        userId,
        ageHours: sessionAge / (60 * 60 * 1000),
      });

      await this.cancelGameSession(sessionId);
      return null;
    }

    this.logger.log(`Session recovered successfully`, { sessionId, userId });
    return session;
  }

  /**
   * Get all interrupted sessions for a user
   */
  async getInterruptedSessions(userId: string): Promise<GameSessionEntity[]> {
    const sessions = await this.gameSessionRepository.find({
      where: {
        userId,
        status: GameStatusEnum.ACTIVE,
      },
      order: { createdAt: 'DESC' },
      take: 10, // Limit to recent sessions
    });

    // Filter out too old sessions
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    return sessions.filter((session) => {
      const sessionAge = now - session.createdAt.getTime();
      return sessionAge <= maxAge;
    });
  }

  /**
   * Clean up old interrupted sessions
   */
  async cleanupOldSessions(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const oldSessions = await this.gameSessionRepository.find({
      where: {
        status: GameStatusEnum.ACTIVE,
        createdAt: new Date(cutoffDate),
      },
    });

    this.logger.log(`Cleaning up ${oldSessions.length} old interrupted sessions`);

    for (const session of oldSessions) {
      try {
        await this.cancelGameSession(session.id);
        this.logger.log(`Cancelled old session ${session.id}`);
      } catch (error) {
        this.logger.error(`Failed to cancel old session ${session.id}:`, error);
      }
    }
  }

  /**
   * Resume a game session with new state
   */
  async resumeGameSession(
    sessionId: string,
    userId: string,
    newGameState?: Record<string, any>,
  ): Promise<GameSessionEntity> {
    const session = await this.recoverGameSession(sessionId, userId);

    if (!session) {
      throw new BadRequestException('Session not found or cannot be recovered');
    }

    // Update game state if provided
    if (newGameState) {
      session.gameState = { ...session.gameState, ...newGameState };

      await this.gameSessionRepository.save(session);

      this.logger.log(`Session state updated`, {
        sessionId,
        userId,
        newStateKeys: Object.keys(newGameState),
      });
    }

    return session;
  }

  /**
   * Validate bet amount
   */
  private validateBetAmount(betAmount: string): void {
    const amount = parseFloat(betAmount);

    if (isNaN(amount) || amount < 0) {
      throw new BadRequestException(ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT);
    }

    // Allow 0 amount bets for demo mode
    // Additional game-specific validation can be added here
    // For now, rely on balance service validation
  }
}
