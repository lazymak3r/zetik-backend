import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  RaceEntity,
  RaceParticipantEntity,
  RaceStatusEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';
import { IBetConfirmedEventPayload } from '../interfaces/ibet-confirmed-event-payload.interface';
import { IBetRefundedEventPayload } from '../interfaces/ibet-refunded-event-payload.interface';

/**
 * RaceWagerTrackerService - High-performance wager accumulation for race leaderboards
 *
 * CLUSTERED BACKEND ARCHITECTURE:
 * This service runs in the CLUSTERED main backend (multiple worker processes).
 * It ONLY handles fast accumulation operations - distribution is handled by race-service.
 *
 * RESPONSIBILITIES:
 * 1. Listen to bet.confirmed events from all workers
 * 2. Accumulate wagers to Redis user:wagers hash (O(1) HINCRBY)
 * 3. Ensure users are added to active races on first bet
 * 4. Recover leaderboards from database on startup (crash recovery)
 *
 * WHAT THIS SERVICE DOES NOT DO:
 * - Distribution to race-specific leaderboards (handled by race-service cron)
 * - Periodic database flushes (handled by race-service cron)
 * - Race finalization (handled by weekly-race-service)
 *
 * REDIS DATA STRUCTURE:
 * - user:wagers (Hash) → { userId: totalWageredCents }
 *   - Fast accumulation from bet events
 *   - Drained by race-service every 10 seconds
 *
 * - race:wagers:{raceId} (Sorted Set) → leaderboards
 *   - Populated by race-service distribution
 *   - Used for real-time leaderboard queries
 */
@Injectable()
export class RaceWagerTrackerService implements OnModuleInit {
  private readonly logger = new Logger(RaceWagerTrackerService.name);

  // Redis key constants - centralized for consistency
  private readonly USER_WAGERS_KEY = 'user:wagers';
  private readonly RACE_WAGERS_KEY_PREFIX = 'race:wagers:';
  private readonly USER_RACES_KEY_PREFIX = 'user:races:';
  private readonly USER_REFCODE_CACHE_KEY_PREFIX = 'user:refcode:';
  private readonly USER_REFCODE_LOCK_KEY_PREFIX = 'lock:user:refcode:';

  // Cache TTL constants
  private readonly REFERRAL_CODE_CACHE_TTL = 3600; // 1 hour
  private readonly REFERRAL_CODE_LOCK_TTL = 5; // 5 seconds for lock

  constructor(
    @InjectRepository(RaceEntity)
    private readonly raceRepo: Repository<RaceEntity>,
    @InjectRepository(RaceParticipantEntity)
    private readonly raceParticipantRepo: Repository<RaceParticipantEntity>,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Module initialization - recovers leaderboards from database
   * Called when service starts (app restart, deployment, crash recovery)
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing RaceWagerTrackerService...');
    await this.recoverLeaderboardsFromDatabase();
  }

  /**
   * Crash Recovery: Restore Redis leaderboards from PostgreSQL
   *
   * Why needed?
   * - Redis is in-memory (data lost on restart)
   * - Database has persistent state
   * - Ensures continuity after deployments/crashes
   *
   * Process:
   * 1. Find all ACTIVE races
   * 2. Load participants from database
   * 3. Rebuild Redis sorted sets (race:wagers:{raceId})
   * 4. Use pipeline for batch performance
   */
  async recoverLeaderboardsFromDatabase(): Promise<void> {
    this.logger.log('Recovering leaderboards from database...');

    const activeRaces = await this.raceRepo.find({
      where: { status: RaceStatusEnum.ACTIVE },
    });

    for (const race of activeRaces) {
      const participants = await this.raceParticipantRepo.find({
        where: { raceId: race.id },
      });

      if (participants.length > 0) {
        // Use pipeline for batch Redis operations (much faster than individual calls)
        const pipeline = this.redisService.getClient().pipeline();

        for (const participant of participants) {
          const wagerCents = BigInt(participant.totalWageredCents);
          if (wagerCents > 0n) {
            // ZADD key score member - add to sorted set (leaderboard)
            pipeline.zadd(`race:wagers:${race.id}`, Number(wagerCents), participant.userId);
          }
        }

        await pipeline.exec();
        this.logger.log(`Recovered ${participants.length} participants for race ${race.id}`);
      }
    }

    this.logger.log('Leaderboards recovery complete');
  }

  /**
   * Event Handler: Process bet confirmation
   *
   * PERFORMANCE CRITICAL:
   * - Handles thousands of bets per second
   * - Must be O(1) and non-blocking
   *
   * Strategy:
   * - Instantly accumulates to user:wagers hash
   * - Does NOT update race leaderboards here (too slow)
   * - Distribution happens in background (every 10 sec)
   *
   * Redis command: HINCRBY user:wagers {userId} {betAmountCents}
   */
  @OnEvent('bet.confirmed')
  async handleBetConfirmed(payload: IBetConfirmedEventPayload): Promise<void> {
    const betAmountCents = Math.floor(parseFloat(payload.betAmountCents || '0'));

    if (betAmountCents <= 0 || isNaN(betAmountCents)) {
      return; // Skip zero or invalid bets
    }

    // Fast accumulation - no DB queries, no race lookups
    await this.redisService
      .getClient()
      .hincrby(this.USER_WAGERS_KEY, payload.userId, betAmountCents);

    // Add user to active races on first bet (users are NOT added on registration)
    this.ensureUserInActiveRaces(payload.userId).catch((err) => {
      this.logger.error(`Failed to ensure user in races: ${err.message}`);
    });
  }

  /**
   * Handle bet.refunded event - decrement wager in races
   */
  @OnEvent('bet.refunded')
  async handleBetRefunded(payload: IBetRefundedEventPayload): Promise<void> {
    const refundAmountCents = Math.floor(parseFloat(payload.refundAmountCents || '0'));

    if (refundAmountCents <= 0 || isNaN(refundAmountCents)) {
      return; // Skip zero or invalid refunds
    }

    // Decrement wager
    await this.redisService
      .getClient()
      .hincrby(this.USER_WAGERS_KEY, payload.userId, -refundAmountCents);
  }

  /**
   * Ensures user is added to all active races (lazy initialization on first bet)
   *
   * This is the ONLY way users get added to races - when they place their first bet.
   * Users are NOT automatically added to races on registration.
   *
   * SIMPLIFIED LOGIC: Users are added to ALL active races regardless of type
   * (no distinction between casino weekly races and affiliate races).
   *
   * Called on every bet, but only does DB writes if user is not yet in races.
   * Redis set `user:races:{userId}` is used as cache to avoid repeated DB checks.
   *
   * This runs async (fire and forget) to not block bet processing.
   */
  /**
   * Get user's referral code with Redis caching and distributed locking
   *
   * Performance optimization: Caches referral codes for 1 hour to reduce DB load
   * Race condition protection: Uses Redis SET NX for distributed locking
   *
   * @param userId - User ID to lookup
   * @returns Referral code or null if user has no affiliate campaign
   */
  private async getUserReferralCode(userId: string): Promise<string | null> {
    const cacheKey = `${this.USER_REFCODE_CACHE_KEY_PREFIX}${userId}`;
    const lockKey = `${this.USER_REFCODE_LOCK_KEY_PREFIX}${userId}`;
    const client = this.redisService.getClient();

    // Try cache first (fast path - no DB query needed)
    const cached = await client.get(cacheKey);
    if (cached !== null) {
      return cached === 'null' ? null : cached;
    }

    // Cache miss - acquire lock to prevent duplicate DB queries
    const lockValue = `${process.pid}-${Date.now()}`;
    const locked = await client.set(lockKey, lockValue, 'EX', this.REFERRAL_CODE_LOCK_TTL, 'NX');

    if (!locked) {
      // Another process is fetching this data, wait for it to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try cache again after waiting
      const retryCache = await client.get(cacheKey);
      if (retryCache !== null) {
        return retryCache === 'null' ? null : retryCache;
      }

      // If still not cached, fall through to fetch (lock expired)
    }

    try {
      // Fetch from DB with optimized queries
      const userRepo = this.raceRepo.manager.getRepository(UserEntity);
      const user = await userRepo.findOne({
        where: { id: userId },
        select: ['id', 'affiliateCampaignId'],
      });

      if (!user) {
        // Cache negative result to prevent repeated lookups
        await client.setex(cacheKey, this.REFERRAL_CODE_CACHE_TTL, 'null');
        return null;
      }

      let referralCode: string | null = null;
      if (user.affiliateCampaignId) {
        const campaignRepo = this.raceRepo.manager.getRepository(AffiliateCampaignEntity);
        const campaign = await campaignRepo.findOne({
          where: { id: user.affiliateCampaignId },
          select: ['code'],
        });
        referralCode = campaign?.code || null;
      }

      // Cache result for 1 hour
      await client.setex(cacheKey, this.REFERRAL_CODE_CACHE_TTL, referralCode || 'null');

      return referralCode;
    } finally {
      // Release lock if we still own it
      if (locked) {
        const currentLock = await client.get(lockKey);
        if (currentLock === lockValue) {
          await client.del(lockKey);
        }
      }
    }
  }

  private async ensureUserInActiveRaces(userId: string): Promise<void> {
    const client = this.redisService.getClient();
    const userRacesKey = `${this.USER_RACES_KEY_PREFIX}${userId}`;

    // Early return optimization: Check if user already has cached races
    // This prevents unnecessary DB queries on every bet after first bet
    const cachedRaceCount = await client.scard(userRacesKey);
    if (cachedRaceCount > 0) {
      // User already has races cached, likely already in all eligible races
      // Quick validation: fetch active races and compare
      const activeRaces = await this.raceRepo.find({
        where: { status: RaceStatusEnum.ACTIVE },
        select: ['id', 'referralCode'],
      });

      if (activeRaces.length === 0) {
        return;
      }

      // Get user's referral code to filter eligible races
      const userReferralCode = await this.getUserReferralCode(userId);

      const eligibleRaceIds = activeRaces
        .filter((race) => {
          if (!race.referralCode) return true; // Weekly races
          return userReferralCode && race.referralCode === userReferralCode;
        })
        .map((r) => r.id);

      if (eligibleRaceIds.length === 0) {
        return;
      }

      // Check if user is in all eligible races (fast Redis check)
      const cachedRaces = await client.smembers(userRacesKey);
      const missingRaces = eligibleRaceIds.filter((id) => !cachedRaces.includes(id));

      if (missingRaces.length === 0) {
        // User is already in all eligible races, skip DB operations
        return;
      }

      // Some races are missing, continue with normal flow
    }

    // Get user's referral code (cached in Redis)
    const userReferralCode = await this.getUserReferralCode(userId);

    // Find all active races (weekly + affiliate)
    const activeRaces = await this.raceRepo.find({
      where: { status: RaceStatusEnum.ACTIVE },
      select: ['id', 'referralCode'],
    });

    if (activeRaces.length === 0) {
      return; // No active races
    }

    // Filter races user should participate in
    const eligibleRaces = activeRaces.filter((race) => {
      // Weekly races (no referralCode) - all users can participate
      if (!race.referralCode) {
        return true;
      }
      // Affiliate races - only users with matching referralCode
      const isMatch = userReferralCode && race.referralCode === userReferralCode;
      return isMatch;
    });

    if (eligibleRaces.length === 0) {
      return;
    }

    // Check which races user is already in (from database)
    const userRaceIds = await this.raceParticipantRepo
      .createQueryBuilder('rp')
      .select('rp.raceId')
      .where('rp.userId = :userId', { userId })
      .andWhere('rp.raceId IN (:...raceIds)', { raceIds: eligibleRaces.map((r) => r.id) })
      .getRawMany();

    const existingRaceIds = new Set(userRaceIds.map((r) => r.raceId));

    // Add user to eligible races they're not already in
    for (const race of eligibleRaces) {
      if (!existingRaceIds.has(race.id)) {
        await this.raceParticipantRepo.upsert(
          {
            raceId: race.id,
            userId,
            totalWageredCents: '0',
            place: null,
            reward: null,
          },
          ['raceId', 'userId'],
        );
      }

      // Always update Redis cache to keep it in sync
      await this.redisService.sAdd(userRacesKey, race.id);
    }
  }

  /**
   * DEPRECATED: This method is still used by race-service RaceFinalizationService
   * during race finalization. It will be refactored to use direct Redis queries
   * in the race-service in the future.
   *
   * Flush single race to database (called before finalization)
   *
   * Why separate method?
   * - Called on-demand during race finalization
   * - No distributed lock needed (finalization already has one)
   * - Ensures final state is persisted before prize distribution
   */
  async flushSingleRaceToDatabase(raceId: string): Promise<void> {
    const client = this.redisService.getClient();
    const leaderboard = await client.zrevrange(
      `${this.RACE_WAGERS_KEY_PREFIX}${raceId}`,
      0,
      -1,
      'WITHSCORES',
    );

    if (leaderboard.length === 0) return;

    const updates: Array<{ raceId: string; userId: string; totalWageredCents: string }> = [];

    for (let i = 0; i < leaderboard.length; i += 2) {
      const userId = leaderboard[i];
      const wagerCents = leaderboard[i + 1];
      updates.push({
        raceId,
        userId,
        totalWageredCents: wagerCents,
      });
    }

    if (updates.length > 0) {
      await this.raceParticipantRepo.upsert(updates, ['raceId', 'userId']);
    }
  }
}
