import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { GameTypeEnum } from '@zetik/common';
import { GAME_DISPLAY_NAMES, IUserRecentGame, UserRecentGamesEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';
import { IUserBetCreatedEvent } from './user-bet.service';

export interface IUserRecentGameResponse {
  gameName: string;
  gameType: GameTypeEnum;
}

/**
 * UserRecentGamesService - Manages "Continue Playing" functionality
 *
 * Redis-first architecture:
 * - Real-time updates in Redis (fast access)
 * - Periodic sync to database every 30 min (persistence)
 * - Database fallback if Redis unavailable
 */
@Injectable()
export class UserRecentGamesService implements OnModuleInit {
  private readonly logger = new Logger(UserRecentGamesService.name);

  // Redis keys
  private readonly REDIS_KEY_PREFIX = 'user:recent:';
  private readonly SYNC_LOCK_KEY = 'lock:user-recent-sync';
  private readonly SYNC_LOCK_TTL = 300; // 5 min lock

  private readonly MAX_GAMES_PER_USER = 40;
  private readonly REDIS_TTL = 24 * 60 * 60; // 24 hours

  constructor(
    @InjectRepository(UserRecentGamesEntity)
    private readonly recentGamesRepo: Repository<UserRecentGamesEntity>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing UserRecentGamesService...');
    await this.recoverFromDatabase();
  }

  /**
   * Handle new bet creation - update user's recent games
   */
  @OnEvent('user-bet.created')
  async handleUserBetCreated(event: IUserBetCreatedEvent): Promise<void> {
    try {
      // Type assertion - we know game and userId are present in actual event
      await this.addRecentGameToRedis(event.userId, event.game!, event.gameName);
    } catch (error) {
      this.logger.error(`Failed to update recent games for user ${event.userId}:`, error);
      // Don't throw - continue processing
    }
  }

  /**
   * Add game to Redis (real-time updates)
   * Uses game:gameName as member to automatically deduplicate on recency update
   */
  private async addRecentGameToRedis(
    userId: string,
    game: GameTypeEnum,
    gameName: string | undefined,
  ): Promise<void> {
    const client = this.redisService.getClient();
    const key = `${this.REDIS_KEY_PREFIX}${userId}`;

    // Use game:gameName as member for automatic deduplication
    // ZADD will update score if member already exists
    const member = `${game}:${gameName || ''}`;
    const score = Date.now();

    // Add to sorted set and keep only top 40
    await client.zadd(key, score, member);
    await client.zremrangebyrank(key, 0, -(this.MAX_GAMES_PER_USER + 1));
    await client.expire(key, this.REDIS_TTL);
  }

  /**
   * Get user's recent games (Redis first, DB fallback)
   */
  async getUserRecentGames(userId: string): Promise<IUserRecentGameResponse[]> {
    try {
      // Try Redis first
      const games = await this.getRecentGamesFromRedis(userId);
      if (games.length > 0) {
        return games;
      }

      // Fallback to database
      this.logger.warn(`No Redis data for user ${userId}, using DB fallback`);
      return await this.getRecentGamesFromDatabase(userId);
    } catch (error) {
      this.logger.error(`Failed to get recent games for user ${userId}:`, error);
      // Ultimate fallback - empty array
      return [];
    }
  }

  /**
   * Get recent games from Redis
   */
  private async getRecentGamesFromRedis(userId: string): Promise<IUserRecentGameResponse[]> {
    const client = this.redisService.getClient();
    const key = `${this.REDIS_KEY_PREFIX}${userId}`;

    // Get top 40 games (newest first)
    const results = await client.zrevrange(key, 0, this.MAX_GAMES_PER_USER - 1);

    const games: IUserRecentGameResponse[] = [];
    for (const member of results) {
      try {
        // Parse game:gameName format
        const parts = member.split(':');
        const game = parts[0] as GameTypeEnum;
        const gameName = parts.slice(1).join(':') || undefined;

        games.push({
          gameName: gameName || GAME_DISPLAY_NAMES[game] || game,
          gameType: game,
        });
      } catch {
        this.logger.warn(`Failed to parse Redis member for user ${userId}`);
      }
    }

    return games;
  }

  /**
   * Get recent games from database (fallback)
   */
  private async getRecentGamesFromDatabase(userId: string): Promise<IUserRecentGameResponse[]> {
    const userRecord = await this.recentGamesRepo.findOne({ where: { userId } });

    if (!userRecord || userRecord.games.length === 0) {
      return [];
    }

    return userRecord.games.map((game) => ({
      gameName: game.gameName || GAME_DISPLAY_NAMES[game.game] || game.game,
      gameType: game.game,
    }));
  }

  /**
   * Periodic sync Redis → Database (every 30 min)
   * Uses distributed lock to ensure only one instance runs
   */
  @Cron('0 */30 * * * *') // Every 30 minutes
  async syncToDatabase(): Promise<void> {
    const lockValue = Date.now().toString();

    try {
      // Try to acquire distributed lock
      const locked = await this.redisService.setNX(
        this.SYNC_LOCK_KEY,
        lockValue,
        this.SYNC_LOCK_TTL,
      );
      if (!locked) {
        this.logger.debug('Sync already running in another instance, skipping');
        return;
      }

      this.logger.log('Starting Redis → Database sync...');
      await this.performDatabaseSync();
      this.logger.log('Redis → Database sync completed');
    } catch (error) {
      this.logger.error('Failed to sync recent games to database:', error);
    } finally {
      // Release lock atomically using Lua script to prevent race conditions
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redisService.eval(script, 1, this.SYNC_LOCK_KEY, lockValue);
    }
  }

  /**
   * Perform the actual sync from Redis to Database
   * Uses SCAN instead of KEYS to avoid blocking Redis
   */
  private async performDatabaseSync(): Promise<void> {
    let cursor = '0';
    const pattern = `${this.REDIS_KEY_PREFIX}*`;
    const pageSize = 100;

    do {
      try {
        // Use SCAN for non-blocking iteration
        const [nextCursor, keys] = await this.redisService.scan(cursor, pattern, pageSize);

        for (const key of keys) {
          const userId = key.replace(this.REDIS_KEY_PREFIX, '');

          try {
            // Get user's recent games from Redis
            const client = this.redisService.getClient();
            const results = await client.zrevrange(key, 0, this.MAX_GAMES_PER_USER - 1);
            const games: IUserRecentGame[] = [];

            for (const member of results) {
              try {
                // Parse game:gameName format
                const parts = member.split(':');
                const game = parts[0] as GameTypeEnum;
                const gameName = parts.slice(1).join(':') || undefined;

                games.push({
                  game,
                  gameName,
                });
              } catch {
                this.logger.warn(`Failed to parse Redis member for sync`);
              }
            }

            if (games.length === 0) continue;

            // Upsert to database
            await this.recentGamesRepo.upsert(
              {
                userId,
                games,
              },
              ['userId'],
            );

            this.logger.debug(`Synced ${games.length} games for user ${userId}`);
          } catch (error) {
            this.logger.error(`Failed to sync user ${userId}:`, error);
          }
        }

        cursor = nextCursor;
      } catch (error) {
        this.logger.error(`Failed to scan Redis keys for sync:`, error);
        break;
      }
    } while (cursor !== '0');

    this.logger.debug(`Database sync completed`);
  }

  /**
   * Recover Redis data from database on service start
   */
  private async recoverFromDatabase(): Promise<void> {
    this.logger.log('Recovering Redis data from database...');

    // Check Redis connectivity first
    if (!(await this.checkRedisHealth())) {
      this.logger.error(
        'Redis is not available during startup - service will operate in DB-fallback mode',
      );
      return;
    }

    try {
      // Get all users with recent games
      const userRecords = await this.recentGamesRepo.find();

      let successCount = 0;
      for (const userRecord of userRecords) {
        try {
          // Restore to Redis
          for (const game of userRecord.games) {
            await this.addRecentGameToRedis(userRecord.userId, game.game, game.gameName);
          }
          successCount++;
        } catch (userError) {
          this.logger.warn(`Failed to recover data for user ${userRecord.userId}:`, userError);
          // Continue with next user
        }
      }

      this.logger.log(
        `Successfully recovered recent games for ${successCount}/${userRecords.length} users`,
      );
    } catch (error) {
      this.logger.error('Failed to recover Redis data from database:', error);
      throw error;
    }
  }

  /**
   * Check if Redis is healthy and available
   */
  private async checkRedisHealth(): Promise<boolean> {
    try {
      const client = this.redisService.getClient();
      await client.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }
}
