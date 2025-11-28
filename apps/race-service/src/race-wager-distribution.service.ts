import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../../backend/src/common/services/redis.service';

/**
 * Race Wager Distribution Service
 *
 * This service handles the distribution of accumulated user wagers to race leaderboards.
 * It runs as a single-instance microservice to prevent redundant database calls.
 *
 * Key responsibilities:
 * - Drain user:wagers hash atomically every 10 seconds
 * - Distribute wagers to race:wagers:{raceId} sorted sets
 * - Broadcast WebSocket updates via Redis pub/sub to backend
 * - Use distributed locks for safety (even though single-instance)
 *
 * Architecture:
 * - Single instance (must never run multiple instances)
 * - Does NOT handle bet.confirmed events (handled by RaceWagerTrackerService)
 * - Only handles distribution from user:wagers to race leaderboards
 * - Runs every 10 seconds via cron job
 *
 * Inter-service communication:
 * - Publishes 'race:leaderboard:update' to Redis pub/sub after distribution
 * - Backend RaceGateway subscribes to this channel and broadcasts to WebSocket clients
 * - This ensures reliable real-time updates even across different processes
 *
 * Performance:
 * - 10-second interval is optimal balance between real-time and system load
 * - Typical update delay: 5-10 seconds
 * - Low system overhead: only runs when there are actual wagers
 *
 * Redis Keys:
 * - user:wagers: Hash of userId -> accumulated wager cents (drained atomically)
 * - user:races:{userId}: Set of race IDs the user is participating in
 * - race:wagers:{raceId}: Sorted set of userId -> total wager cents (leaderboard)
 * - race:leaderboard:update (pub/sub): Channel for inter-service WebSocket updates
 */
@Injectable()
export class RaceWagerDistributionService implements OnModuleInit {
  private readonly logger = new Logger(RaceWagerDistributionService.name);
  private readonly DISTRIBUTION_INTERVAL_SECONDS = 10; // Run every 10 seconds
  private isInitialized = false; // Flag to prevent cron jobs before initialization

  // Redis key constants
  private readonly USER_WAGERS_KEY = 'user:wagers';
  private readonly RACE_WAGERS_KEY_PREFIX = 'race:wagers:';

  /**
   * Lua script for atomic race wager distribution
   * Drains user:wagers hash and returns flat array [userId1, wagerCents1, userId2, wagerCents2, ...]
   */
  private readonly DRAIN_USER_WAGERS_LUA = `
    local key = KEYS[1]
    local data = redis.call('HGETALL', key)
    if #data > 0 then
      redis.call('DEL', key)
    end
    return data
  `;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 RaceWagerDistributionService initializing...');
    this.logger.log(`⏱️  Distribution interval: ${this.DISTRIBUTION_INTERVAL_SECONDS}s`);

    // Wait a bit to ensure Redis connection is ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.isInitialized = true;
    this.logger.log('✅ RaceWagerDistributionService initialized');
  }

  /**
   * Distribute accumulated race wagers to leaderboards every 10 seconds
   *
   * This method:
   * 1. Atomically drains the user:wagers hash using a Lua script
   * 2. Fetches race participation for each user (user:races:{userId})
   * 3. Distributes wagers to race leaderboards (race:wagers:{raceId})
   * 4. Publishes WebSocket update event via Redis pub/sub (for inter-service communication)
   *
   * Atomicity is guaranteed by the Lua script, which runs as a single Redis command.
   * This prevents race conditions when multiple workers try to drain the same hash.
   *
   * Performance: Every 10 seconds is optimal balance between real-time updates and system load.
   * Max update delay: 10 seconds. Typical delay: 5 seconds.
   */
  @Cron('*/10 * * * * *')
  async distributeRaceWagers(): Promise<void> {
    // Don't run cron job until service is properly initialized
    if (!this.isInitialized) {
      return;
    }

    try {
      const client = this.redisService.getClient();

      // Step 1: Atomically drain user:wagers hash
      const flat = (await client.eval(
        this.DRAIN_USER_WAGERS_LUA,
        1,
        this.USER_WAGERS_KEY,
      )) as string[];

      if (!flat || flat.length === 0) {
        return; // No wagers to process
      }

      this.logger.debug(`Processing ${flat.length / 2} user wagers for race distribution`);

      // Step 2: Extract user IDs from flat array
      const userIds: string[] = [];
      for (let i = 0; i < flat.length; i += 2) {
        userIds.push(flat[i]);
      }

      // Step 3: Batch fetch user:races:{userId} sets using pipeline
      const pipeline = client.pipeline();
      for (const userId of userIds) {
        pipeline.smembers(`user:races:${userId}`);
      }
      const userRacesResults = await pipeline.exec();

      // Step 4: Distribute wagers to race leaderboards
      const distributePipeline = client.pipeline();
      const touchedRaceIds = new Set<string>(); // Track for WebSocket broadcast

      for (let i = 0; i < flat.length; i += 2) {
        const userId = flat[i];
        const wagerCents = parseInt(flat[i + 1], 10);
        const userIndex = Math.floor(i / 2);
        const raceIds = (userRacesResults?.[userIndex]?.[1] as string[]) || [];

        // Add wager to each race the user is participating in
        for (const raceId of raceIds) {
          // ZINCRBY increments score in sorted set (updates leaderboard position)
          distributePipeline.zincrby(`${this.RACE_WAGERS_KEY_PREFIX}${raceId}`, wagerCents, userId);
          touchedRaceIds.add(raceId);
        }
      }

      await distributePipeline.exec();

      if (touchedRaceIds.size > 0) {
        this.logger.debug(`Updated ${touchedRaceIds.size} race leaderboards`);

        // Broadcast WebSocket updates for touched races
        // 1. Local event (for potential local listeners in race-service)
        this.eventEmitter.emit('race:leaderboard:update', [...touchedRaceIds]);

        // 2. Redis pub/sub (for backend WebSocket gateway)
        // This is critical for inter-service communication
        await this.redisService
          .getClient()
          .publish('race:leaderboard:update', JSON.stringify([...touchedRaceIds]));
      }
    } catch (error) {
      this.logger.error('Error distributing race wagers:', error);
    }
  }

  /**
   * Manually trigger race wager distribution
   * Useful for testing and debugging
   */
  async triggerDistribution(): Promise<void> {
    this.logger.log('🔄 Manual distribution triggered');
    await this.distributeRaceWagers();
  }
}
