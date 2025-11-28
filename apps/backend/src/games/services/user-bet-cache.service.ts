import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../../common/services/redis.service';

export interface IUserBetCacheData {
  userId: string;
  totalBetAmount: string;
  totalPayout: string;
  lastBetTime: string;
}

export interface IUserBetCreatedEvent {
  userId: string;
  betAmountUsd: string;
  payoutUsd: string;
}

@Injectable()
export class UserBetCacheService {
  private readonly logger = new Logger(UserBetCacheService.name);
  private readonly REDIS_KEY_PREFIX = 'user-bet-cache';
  private readonly TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

  // Static registry for global access
  private static instance: UserBetCacheService | null = null;

  constructor(private readonly redisService: RedisService) {
    // Register this instance globally
    UserBetCacheService.instance = this;
    this.logger.log('UserBetCacheService instance registered globally');
  }

  static getInstance(): UserBetCacheService | null {
    return UserBetCacheService.instance;
  }

  @OnEvent('user-bet.created')
  async handleUserBetCreated(event: IUserBetCreatedEvent): Promise<void> {
    this.logger.debug(
      `Handling user-bet.created event for user ${event.userId}: bet=${event.betAmountUsd}, payout=${event.payoutUsd}`,
    );
    try {
      await this.updateUserBetCache(event.userId, event.betAmountUsd, event.payoutUsd);
      this.logger.debug(`Successfully processed user-bet.created event for user ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to handle user-bet.created event for user ${event.userId}:`, error);
      // Don't throw here to prevent event system issues
    }
  }

  /**
   * Update user bet cache when they place a bet
   */
  async updateUserBetCache(userId: string, betAmountUsd: string, payoutUsd: string): Promise<void> {
    try {
      const weekKey = this.getWeekKey();
      const cacheKey = `${this.REDIS_KEY_PREFIX}:${weekKey}:${userId}`;

      // Get existing data
      const existingData = await this.getUserBetCache(userId, weekKey);

      // Calculate new totals
      const previousBetAmount = parseFloat(existingData?.totalBetAmount || '0');
      const previousPayout = parseFloat(existingData?.totalPayout || '0');
      const newTotalBetAmount = (previousBetAmount + parseFloat(betAmountUsd)).toString();
      const newTotalPayout = (previousPayout + parseFloat(payoutUsd)).toString();

      // Update cache data
      const cacheData: IUserBetCacheData = {
        userId,
        totalBetAmount: newTotalBetAmount,
        totalPayout: newTotalPayout,
        lastBetTime: new Date().toISOString(),
      };

      await this.redisService.set(cacheKey, JSON.stringify(cacheData), this.TTL_SECONDS);

      this.logger.debug(
        `Updated user bet cache for ${userId} (week ${weekKey}): ` +
          `bet ${previousBetAmount} → ${newTotalBetAmount} (+${betAmountUsd}), ` +
          `payout ${previousPayout} → ${newTotalPayout} (+${payoutUsd})`,
      );

      // Update weekly leaderboard
      await this.updateWeeklyLeaderboard(userId, parseFloat(newTotalBetAmount), weekKey);
    } catch (error) {
      this.logger.error(
        `Failed to update user bet cache for ${userId} (bet: ${betAmountUsd}, payout: ${payoutUsd}):`,
        error,
      );
      throw error; // Re-throw to allow fallback handling
    }
  }

  /**
   * Get user bet cache data
   */
  async getUserBetCache(userId: string, weekKey?: string): Promise<IUserBetCacheData | null> {
    try {
      const week = weekKey || this.getWeekKey();
      const cacheKey = `${this.REDIS_KEY_PREFIX}:${week}:${userId}`;

      const dataStr = await this.redisService.get(cacheKey);
      if (!dataStr) {
        return null;
      }

      return JSON.parse(dataStr);
    } catch (error) {
      this.logger.error(`Failed to get user bet cache for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Get weekly leaderboard data
   */
  async getWeeklyLeaderboard(weekKey?: string): Promise<Array<{ userId: string; score: number }>> {
    try {
      const week = weekKey || this.getWeekKey();
      const leaderboardKey = `${this.REDIS_KEY_PREFIX}:leaderboard:${week}`;

      const dataStr = await this.redisService.get(leaderboardKey);
      if (!dataStr) {
        return [];
      }

      const leaderboard: Array<{ userId: string; score: number }> = JSON.parse(dataStr);
      return leaderboard.sort((a, b) => b.score - a.score);
    } catch (error) {
      this.logger.error(`Failed to get weekly leaderboard:`, error);
      return [];
    }
  }

  /**
   * Update weekly leaderboard
   */
  private async updateWeeklyLeaderboard(
    userId: string,
    score: number,
    weekKey: string,
  ): Promise<void> {
    try {
      const leaderboardKey = `${this.REDIS_KEY_PREFIX}:leaderboard:${weekKey}`;

      // Get current leaderboard
      const leaderboard = await this.getWeeklyLeaderboard(weekKey);

      // Update or add user score
      const existingIndex = leaderboard.findIndex((entry) => entry.userId === userId);

      if (existingIndex >= 0) {
        leaderboard[existingIndex].score = score;
      } else {
        leaderboard.push({ userId, score });
      }

      // Save updated leaderboard
      await this.redisService.set(leaderboardKey, JSON.stringify(leaderboard), this.TTL_SECONDS);
    } catch (error) {
      this.logger.error(`Failed to update weekly leaderboard for ${userId}:`, error);
    }
  }

  /**
   * Get current week key (YYYY-WW format)
   */
  private getWeekKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    return `${year}-${weekNumber.toString().padStart(2, '0')}`;
  }

  /**
   * Clear cache data (for testing purposes)
   */
  async clearCacheData(weekKey?: string): Promise<void> {
    try {
      const week = weekKey || this.getWeekKey();
      const leaderboardKey = `${this.REDIS_KEY_PREFIX}:leaderboard:${week}`;

      await this.redisService.del(leaderboardKey);
      this.logger.log(`Cleared cache data for week ${week}`);
    } catch (error) {
      this.logger.error(`Failed to clear cache data:`, error);
    }
  }

  async clearUserCaches(weekKey: string): Promise<void> {
    try {
      const pattern = `${this.REDIS_KEY_PREFIX}:${weekKey}:*`;
      const keys = await this.redisService.keys(pattern);
      if (keys.length > 0) {
        for (const key of keys) {
          await this.redisService.del(key);
        }
      }
      this.logger.log(`Cleared ${keys.length} user caches for week ${weekKey}`);
    } catch (error) {
      this.logger.error(`Failed to clear user caches for ${weekKey}:`, error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redisService.keys(pattern);
  }
}
