import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  GameBetLimitsEntity,
  GameBetTypeLimitsEntity,
  GameConfigEntity,
  GameStatus,
  GameType,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { BetLimitsUpdate, GameConfig } from './types/admin-game-config.types';

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(GameConfigEntity)
    private readonly gameConfigRepo: Repository<GameConfigEntity>,
    @InjectRepository(GameBetLimitsEntity)
    private readonly betLimitsRepo: Repository<GameBetLimitsEntity>,
    @InjectRepository(GameBetTypeLimitsEntity)
    private readonly betTypeLimitsRepo: Repository<GameBetTypeLimitsEntity>,
  ) {}

  async getGameConfigs(): Promise<GameConfig[]> {
    try {
      const configs = await this.gameConfigRepo.find({
        order: { gameType: 'ASC' },
      });

      const betLimits = await this.betLimitsRepo.find({
        where: { isActive: true },
      });

      // Create a map for quick lookup of bet limits
      const betLimitsMap = new Map<GameType, GameBetLimitsEntity>();
      betLimits.forEach((limit) => {
        betLimitsMap.set(limit.gameType, limit);
      });

      const result = configs.map((config) => {
        const limits = betLimitsMap.get(config.gameType);
        if (!limits) {
          throw new Error(`Missing bet limits for game type: ${config.gameType}`);
        }
        return {
          gameType: config.gameType,
          status: config.status,
          name: config.name,
          description: config.description,
          minBetUsd: Number(limits.minBetUsd),
          maxBetUsd: Number(limits.maxBetUsd),
          maxPayoutUsd: Number(limits.maxPayoutUsd),
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };
      });

      return result;
    } catch (error) {
      console.error('*** DEBUG: Error in GamesService.getGameConfigs:', error);
      throw error;
    }
  }

  async updateGameStatus(gameType: GameType, status: GameStatus): Promise<void> {
    await this.gameConfigRepo.update({ gameType }, { status });
    this.logger.log(`Updated ${gameType} status to ${status}`);
  }

  async getBetLimits(): Promise<BetLimitsUpdate[]> {
    const limits = await this.betLimitsRepo.find({
      where: { isActive: true },
      order: { gameType: 'ASC' },
    });

    return limits.map((limit) => ({
      gameType: limit.gameType,
      minBetUsd: Number(limit.minBetUsd),
      maxBetUsd: Number(limit.maxBetUsd),
      maxPayoutUsd: Number(limit.maxPayoutUsd),
    }));
  }

  async updateBetLimits(
    gameType: GameType,
    minBetUsd: number,
    maxBetUsd: number,
    maxPayoutUsd: number,
    updatedBy?: string,
  ): Promise<void> {
    await this.betLimitsRepo.update(
      { gameType },
      {
        minBetUsd,
        maxBetUsd,
        maxPayoutUsd,
        updatedBy,
      },
    );
    this.logger.log(
      `Updated bet limits for ${gameType}: $${minBetUsd} - $${maxBetUsd}, max payout: $${maxPayoutUsd}`,
    );
  }

  /**
   * Get all bet type limits for all games
   */
  async getAllBetTypeLimits(): Promise<any[]> {
    const betTypeLimits = await this.betTypeLimitsRepo.find({
      where: { isActive: true },
      order: { gameType: 'ASC', betTypeCategory: 'ASC' },
    });

    return betTypeLimits.map((limit) => ({
      id: limit.id,
      gameType: limit.gameType,
      betTypeCategory: limit.betTypeCategory,
      description: limit.description,
      minBetUsd: Number(limit.minBetUsd),
      maxBetUsd: Number(limit.maxBetUsd),
      isActive: limit.isActive,
      createdAt: limit.createdAt,
      updatedAt: limit.updatedAt,
    }));
  }

  /**
   * Get bet type limits for a specific game
   */
  async getBetTypeLimitsByGame(gameType: GameType): Promise<any[]> {
    const betTypeLimits = await this.betTypeLimitsRepo.find({
      where: { gameType, isActive: true },
      order: { betTypeCategory: 'ASC' },
    });

    return betTypeLimits.map((limit) => ({
      id: limit.id,
      gameType: limit.gameType,
      betTypeCategory: limit.betTypeCategory,
      description: limit.description,
      minBetUsd: Number(limit.minBetUsd),
      maxBetUsd: Number(limit.maxBetUsd),
      isActive: limit.isActive,
      createdAt: limit.createdAt,
      updatedAt: limit.updatedAt,
    }));
  }

  /**
   * Update bet type limits
   */
  async updateBetTypeLimits(
    id: string,
    minBetUsd: number,
    maxBetUsd: number,
    updatedBy?: string,
  ): Promise<void> {
    const result = await this.betTypeLimitsRepo.update(
      { id },
      {
        minBetUsd,
        maxBetUsd,
        updatedBy,
        updatedAt: new Date(),
      },
    );

    if (result.affected === 0) {
      throw new Error(`Bet type limit with ID ${id} not found`);
    }

    this.logger.log(`Updated bet type limits for ID ${id}: $${minBetUsd} - $${maxBetUsd}`);
  }

  getGameStats(): any[] {
    // TODO: Implement real game statistics from database
    throw new Error(
      'Game statistics not implemented yet - requires connection to statistics tables',
    );
  }
}
