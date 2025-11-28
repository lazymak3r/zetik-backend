import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { SessionTrackingEntity } from '@zetik/shared-entities';
import * as geoip from 'geoip-lite';
import { createHash } from 'node:crypto';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';

export interface ISessionData {
  sessionId: string;
  tokenHash: string;
  userId: string;
  deviceInfo?: string;
  ipAddress: string;
  location?: string;
  lastActivityAt: number;
}

interface ISessionMetrics {
  redisHits: number;
  redisMisses: number;
  dbSyncs: number;
  lastSyncAt: Date | null;
}

@Injectable()
export class SessionTrackingService implements OnModuleInit {
  private readonly logger = new Logger(SessionTrackingService.name);

  private readonly REDIS_KEY_PREFIX = 'session:';
  private readonly REDIS_HASH_BY_TOKEN = 'session:by-token:';
  private readonly REDIS_USER_SESSIONS_SET = 'session:user:'; // Index: user's session IDs
  private readonly REDIS_ACTIVE_SESSIONS_SET = 'session:active-sessions'; // Active sessions count
  private readonly ACTIVITY_TIMEOUT_MS = 1 * 60 * 1000; // 1 minute
  private readonly REDIS_SESSION_TTL_DAYS = 30; // Align with refresh token expiration (30 days)
  private readonly INACTIVE_SESSION_DAYS = 35; // 30 days refresh token + 5 days buffer

  private metrics: ISessionMetrics = {
    redisHits: 0,
    redisMisses: 0,
    dbSyncs: 0,
    lastSyncAt: null,
  };

  private readonly SYNC_LOCK_KEY = 'cron-lock:session-sync';
  private readonly CLEANUP_LOCK_KEY = 'cron-lock:session-cleanup';
  private readonly LOAD_DB_LOCK_KEY = 'cron-lock:session-load-db';

  constructor(
    @InjectRepository(SessionTrackingEntity)
    private readonly sessionRepo: Repository<SessionTrackingEntity>,
    private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Add random startup delay to prevent DB stampede in cluster mode
    // With 8 workers, this spreads startup load over 5 seconds
    const startupDelay = Math.random() * 5000;
    await new Promise((resolve) => setTimeout(resolve, startupDelay));

    await this.loadActiveSessionsFromDB();
  }

  async createSession(
    tokenHash: string,
    userId: string,
    ipAddress: string,
    deviceInfo?: string,
  ): Promise<string> {
    const now = Date.now();
    const location = this.getLocationFromIP(ipAddress);

    const entity = new SessionTrackingEntity();
    entity.userId = userId;
    entity.tokenHash = tokenHash;
    entity.deviceInfo = deviceInfo;
    entity.ipAddress = ipAddress;
    entity.location = location;
    entity.lastActivityAt = new Date(now);

    const saved = await this.sessionRepo.save(entity);

    const sessionData: ISessionData = {
      sessionId: saved.id,
      tokenHash,
      userId,
      deviceInfo,
      ipAddress,
      location,
      lastActivityAt: now,
    };

    await this.saveSessionToRedis(sessionData);

    return saved.id;
  }

  async updateSessionTokenHash(sessionId: string, newTokenHash: string): Promise<void> {
    try {
      const session = await this.getSessionFromRedis(sessionId);
      if (!session) {
        this.logger.warn(`Session ${sessionId} not found for token hash update`);
        return;
      }

      const oldTokenHash = session.tokenHash;

      session.tokenHash = newTokenHash;
      await this.saveSessionToRedis(session);

      await this.sessionRepo.update(sessionId, { tokenHash: newTokenHash });

      if (oldTokenHash !== newTokenHash) {
        await this.redisService.del(this.getTokenHashKey(oldTokenHash));
      }
    } catch (error) {
      this.logger.error(
        `Failed to update session token hash: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async updateActivity(tokenHash: string, ipAddress: string): Promise<void> {
    const sessionId = await this.getSessionIdByTokenHash(tokenHash);
    if (!sessionId) {
      return;
    }

    const sessionData = await this.getSessionFromRedis(sessionId);
    if (!sessionData) {
      return;
    }

    const now = Date.now();
    const oldIp = sessionData.ipAddress;

    sessionData.lastActivityAt = now;
    sessionData.ipAddress = ipAddress;

    if (oldIp !== ipAddress) {
      const location = this.getLocationFromIP(ipAddress);
      if (location) {
        sessionData.location = location;
      }
    }

    await this.saveSessionToRedis(sessionData);

    // ✅ Add sessionId to active sessions Sorted Set for O(1) count
    try {
      await this.redisService.getClient().zadd(
        this.REDIS_ACTIVE_SESSIONS_SET,
        now, // Score = timestamp for auto-expiration
        sessionData.sessionId, // Store sessionId to count devices
      );

      // Remove sessions inactive for >1 minute
      const cutoffTime = now - this.ACTIVITY_TIMEOUT_MS;
      await this.redisService
        .getClient()
        .zremrangebyscore(this.REDIS_ACTIVE_SESSIONS_SET, '-inf', cutoffTime);
    } catch (error) {
      this.logger.warn('Failed to update active sessions set', error);
    }
  }

  async getSessionByTokenHash(tokenHash: string): Promise<ISessionData | null> {
    const sessionId = await this.getSessionIdByTokenHash(tokenHash);
    if (!sessionId) {
      return null;
    }
    return this.getSessionFromRedis(sessionId);
  }

  async getSession(sessionId: string): Promise<ISessionData | null> {
    return this.getSessionFromRedis(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSessionFromRedis(sessionId);
    if (session) {
      await this.redisService.del(this.getTokenHashKey(session.tokenHash));
      // Remove from active sessions Sorted Set
      await this.redisService.getClient().zrem(this.REDIS_ACTIVE_SESSIONS_SET, session.sessionId);
      // Remove from user's session index
      const userSessionsKey = `${this.REDIS_USER_SESSIONS_SET}${session.userId}`;
      await this.redisService.srem(userSessionsKey, session.sessionId);
    }

    const sessionKey = this.getRedisKey(sessionId);
    await this.redisService.del(sessionKey);
    await this.sessionRepo.delete(sessionId);
  }

  async getUserSessions(userId: string): Promise<ISessionData[]> {
    const MAX_SESSIONS_PER_USER = 50; // Prevent memory exhaustion from thousands of sessions

    // Use user session index for O(1) lookup instead of SCAN
    const userSessionsKey = `${this.REDIS_USER_SESSIONS_SET}${userId}`;
    const sessionIds = await this.redisService.smembers(userSessionsKey);

    if (sessionIds.length === 0) {
      return [];
    }

    // If user has excessive sessions (attack/bug), log warning and limit
    if (sessionIds.length > MAX_SESSIONS_PER_USER) {
      this.logger.warn(
        `User ${userId} has ${sessionIds.length} sessions (exceeds limit ${MAX_SESSIONS_PER_USER})`,
      );
    }

    // Batch fetch session data using pipeline (limit to prevent memory issues)
    const limitedSessionIds = sessionIds.slice(0, MAX_SESSIONS_PER_USER);
    const pipeline = this.redisService.getClient().pipeline();
    limitedSessionIds.forEach((sessionId) => {
      const sessionKey = this.getRedisKey(sessionId);
      pipeline.hgetall(sessionKey);
    });

    const results = await pipeline.exec();
    const userSessions: ISessionData[] = [];

    if (results) {
      for (const [err, data] of results) {
        if (!err && data) {
          const sessionData = this.parseSessionData(data);
          if (sessionData) {
            userSessions.push(sessionData);
          }
        }
      }
    }

    // Sort by last activity (most recent first)
    userSessions.sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    return userSessions;
  }

  /**
   * Get active sessions (fallback method, rarely used)
   * Note: Uses SCAN which can be slow - prefer getUserSessions() with user index
   */
  async getActiveSessions(userId?: string): Promise<ISessionData[]> {
    const pattern = userId ? `${this.REDIS_KEY_PREFIX}*` : `${this.REDIS_KEY_PREFIX}*`;
    let cursor = '0';
    const allSessions: ISessionData[] = [];
    const now = Date.now();

    do {
      const [nextCursor, keys] = await this.redisService.scan(cursor, pattern, 500);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = this.redisService.getClient().pipeline();
        keys.forEach((key) => pipeline.hgetall(key));
        const results = await pipeline.exec();

        if (results) {
          for (const [err, data] of results) {
            if (!err && data) {
              const sessionData = this.parseSessionData(data);
              if (sessionData) {
                if (!userId || sessionData.userId === userId) {
                  const isActive = now - sessionData.lastActivityAt < this.ACTIVITY_TIMEOUT_MS;
                  if (isActive) {
                    allSessions.push(sessionData);
                  }
                }
              }
            }
          }
        }
      }
    } while (cursor !== '0');

    return allSessions;
  }

  /**
   * ✅ Get active user count using Redis Sorted Set (O(1) operation)
   * Much faster than scanning all sessions
   */
  async getActiveUserCount(): Promise<number> {
    try {
      const now = Date.now();
      const cutoffTime = now - this.ACTIVITY_TIMEOUT_MS;

      // Remove expired sessions first
      await this.redisService
        .getClient()
        .zremrangebyscore(this.REDIS_ACTIVE_SESSIONS_SET, '-inf', cutoffTime);

      // Count remaining active sessions (devices)
      const count = await this.redisService.getClient().zcard(this.REDIS_ACTIVE_SESSIONS_SET);
      return count;
    } catch (error) {
      this.logger.error('Failed to get active sessions count from Redis Sorted Set', error);
      // Fallback to old method
      const sessions = await this.getActiveSessions();
      const uniqueUsers = new Set(sessions.map((s) => s.userId));
      return uniqueUsers.size;
    }
  }

  async isSessionActive(sessionId: string): Promise<boolean> {
    const session = await this.getSessionFromRedis(sessionId);
    if (!session) {
      return false;
    }

    const now = Date.now();
    const timeSinceActivity = now - session.lastActivityAt;
    return timeSinceActivity < this.ACTIVITY_TIMEOUT_MS;
  }

  /**
   * ✅ Batch check if multiple sessions are active (optimized for N queries)
   * @param sessionIds Array of session IDs to check
   * @returns Map of sessionId -> isActive
   */
  async areSessionsActive(sessionIds: string[]): Promise<Map<string, boolean>> {
    const result = new Map<string, boolean>();
    const now = Date.now();

    if (sessionIds.length === 0) {
      return result;
    }

    try {
      // Batch fetch all sessions using Redis pipeline
      const pipeline = this.redisService.getClient().pipeline();
      sessionIds.forEach((sessionId) => {
        const sessionKey = this.getRedisKey(sessionId);
        pipeline.hgetall(sessionKey);
      });

      const results = await pipeline.exec();

      if (results) {
        for (let i = 0; i < results.length; i++) {
          const [err, data] = results[i];
          const sessionId = sessionIds[i];

          if (!err && data) {
            const sessionData = this.parseSessionData(data);
            if (sessionData) {
              const timeSinceActivity = now - sessionData.lastActivityAt;
              result.set(sessionId, timeSinceActivity < this.ACTIVITY_TIMEOUT_MS);
            } else {
              result.set(sessionId, false);
            }
          } else {
            result.set(sessionId, false);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to batch check session activity', error);
      // Fallback: mark all as inactive on error
      sessionIds.forEach((sessionId) => result.set(sessionId, false));
    }

    return result;
  }

  /**
   * ✅ Sync sessions from Redis to Database with distributed lock
   * Uses Redis setNX for leader election in multi-instance deployments
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncSessionsToDB(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}`;

    try {
      // ✅ Acquire distributed lock (only one instance executes)
      const locked = await this.redisService.setNX(this.SYNC_LOCK_KEY, lockValue, 300); // 5 min TTL
      if (!locked) {
        return;
      }

      const sessions = await this.getAllSessionsFromRedis();

      if (sessions.length === 0) {
        return;
      }

      const entities = sessions.map((session) => {
        const entity = new SessionTrackingEntity();
        entity.id = session.sessionId;
        entity.tokenHash = session.tokenHash;
        entity.userId = session.userId;
        entity.deviceInfo = session.deviceInfo;
        entity.ipAddress = session.ipAddress;
        entity.location = session.location;
        entity.lastActivityAt = new Date(session.lastActivityAt);
        return entity;
      });

      // ✅ Use upsert to handle conflicts (when session already exists in DB)
      await this.sessionRepo.upsert(entities, {
        conflictPaths: ['id'], // Primary key
        skipUpdateIfNoValuesChanged: true, // Optimize: skip if no changes
      });

      this.metrics.dbSyncs++;
      this.metrics.lastSyncAt = new Date();
    } catch (error) {
      this.logger.error('Failed to sync sessions to database', error);
    } finally {
      // ✅ Release lock atomically using Lua script (prevent race conditions)
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redisService.eval(script, 1, this.SYNC_LOCK_KEY, lockValue).catch((error) => {
        this.logger.error('Failed to release sync lock', error);
      });
    }
  }

  /**
   * ✅ Cleanup inactive sessions with distributed lock
   * Uses Redis setNX for leader election in multi-instance deployments
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupInactiveSessions(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}`;

    try {
      // ✅ Acquire distributed lock (only one instance executes)
      const locked = await this.redisService.setNX(this.CLEANUP_LOCK_KEY, lockValue, 3600); // 1 hour TTL
      if (!locked) {
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.INACTIVE_SESSION_DAYS);

      const inactiveSessions = await this.sessionRepo.find({
        where: {
          lastActivityAt: LessThan(cutoffDate),
        },
        select: ['id'],
      });

      for (const session of inactiveSessions) {
        await this.deleteSession(session.id);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup inactive sessions', error);
    } finally {
      // ✅ Release lock atomically using Lua script (prevent race conditions)
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redisService.eval(script, 1, this.CLEANUP_LOCK_KEY, lockValue).catch((error) => {
        this.logger.error('Failed to release cleanup lock', error);
      });
    }
  }

  /**
   * Load active sessions from DB to Redis on startup
   * Uses distributed lock to ensure only ONE instance loads data in cluster mode
   */
  private async loadActiveSessionsFromDB(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}`;

    try {
      // ✅ Acquire distributed lock (only one instance loads from DB)
      const locked = await this.redisService.setNX(this.LOAD_DB_LOCK_KEY, lockValue, 60); // 1 min TTL
      if (!locked) {
        // Another instance is already loading, skip
        return;
      }

      const recentCutoff = new Date();
      recentCutoff.setMinutes(recentCutoff.getMinutes() - 30);

      const recentSessions = await this.sessionRepo.find({
        where: {
          lastActivityAt: MoreThan(recentCutoff),
        },
      });

      for (const session of recentSessions) {
        const sessionData: ISessionData = {
          sessionId: session.id,
          tokenHash: session.tokenHash,
          userId: session.userId,
          deviceInfo: session.deviceInfo,
          ipAddress: session.ipAddress,
          location: session.location,
          lastActivityAt: session.lastActivityAt.getTime(),
        };
        await this.saveSessionToRedis(sessionData);
      }
    } catch (error) {
      this.logger.error('Failed to load sessions from database', error);
    } finally {
      // Release lock using Lua script (atomic)
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redisService.eval(script, 1, this.LOAD_DB_LOCK_KEY, lockValue).catch((error) => {
        this.logger.error('Failed to release load DB lock', error);
      });
    }
  }

  private getRedisKey(sessionId: string): string {
    return `${this.REDIS_KEY_PREFIX}${sessionId}`;
  }

  private getTokenHashKey(tokenHash: string): string {
    return `${this.REDIS_HASH_BY_TOKEN}${tokenHash}`;
  }

  private async getSessionIdByTokenHash(tokenHash: string): Promise<string | null> {
    const sessionId = await this.redisService.get(this.getTokenHashKey(tokenHash));
    return sessionId;
  }

  private async saveSessionToRedis(session: ISessionData): Promise<void> {
    const sessionKey = this.getRedisKey(session.sessionId);
    const data: Record<string, string> = {
      sessionId: session.sessionId,
      tokenHash: session.tokenHash,
      userId: session.userId,
      ipAddress: session.ipAddress,
      lastActivityAt: session.lastActivityAt.toString(),
    };

    if (session.deviceInfo) {
      data.deviceInfo = session.deviceInfo;
    }
    if (session.location) {
      data.location = session.location;
    }

    await this.redisService.getClient().hmset(sessionKey, data);

    await this.redisService.set(this.getTokenHashKey(session.tokenHash), session.sessionId);

    // Add sessionId to user's session index for O(1) lookup
    const userSessionsKey = `${this.REDIS_USER_SESSIONS_SET}${session.userId}`;
    await this.redisService.sadd(userSessionsKey, session.sessionId);

    // ✅ TTL aligned with refresh token expiration (30 days)
    // DB retains sessions for 35 days (30 + 5 day buffer)
    const ttlSeconds = this.REDIS_SESSION_TTL_DAYS * 24 * 60 * 60;
    await this.redisService.expire(userSessionsKey, ttlSeconds);
    await this.redisService.expire(sessionKey, ttlSeconds);
    await this.redisService.expire(this.getTokenHashKey(session.tokenHash), ttlSeconds);
  }

  private async getSessionFromRedis(sessionId: string): Promise<ISessionData | null> {
    const sessionKey = this.getRedisKey(sessionId);
    const data = await this.redisService.getClient().hgetall(sessionKey);

    if (!data || Object.keys(data).length === 0) {
      this.metrics.redisMisses++;
      return null;
    }

    this.metrics.redisHits++;
    return this.parseSessionData(data);
  }

  private parseSessionData(data: Record<string, string> | object): ISessionData | null {
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    const sessionData = data as Record<string, string>;

    if (
      !sessionData.sessionId ||
      !sessionData.tokenHash ||
      !sessionData.userId ||
      !sessionData.lastActivityAt
    ) {
      return null;
    }

    return {
      sessionId: sessionData.sessionId,
      tokenHash: sessionData.tokenHash,
      userId: sessionData.userId,
      deviceInfo: sessionData.deviceInfo,
      ipAddress: sessionData.ipAddress,
      location: sessionData.location,
      lastActivityAt: parseInt(sessionData.lastActivityAt, 10),
    };
  }

  /**
   * Get ALL sessions from Redis (batch operation)
   * Note: Uses SCAN which is acceptable here as it runs infrequently (cron job every 5 min)
   */
  private async getAllSessionsFromRedis(): Promise<ISessionData[]> {
    const pattern = `${this.REDIS_KEY_PREFIX}*`;
    let cursor = '0';
    const allSessions: ISessionData[] = [];

    do {
      const [nextCursor, keys] = await this.redisService.scan(cursor, pattern, 500);
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = this.redisService.getClient().pipeline();
        keys.forEach((key) => pipeline.hgetall(key));
        const results = await pipeline.exec();

        if (results) {
          for (const [err, data] of results) {
            if (!err && data) {
              const sessionData = this.parseSessionData(data as Record<string, string>);
              if (sessionData) {
                allSessions.push(sessionData);
              }
            }
          }
        }
      }
    } while (cursor !== '0');

    return allSessions;
  }

  private getLocationFromIP(ipAddress: string): string {
    try {
      if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
        return 'Local Development';
      }

      if (this.isPrivateIP(ipAddress)) {
        return 'Private Network';
      }

      const geo = geoip.lookup(ipAddress);
      let location = 'Unknown Location';

      if (geo && geo.city && geo.country) {
        location = `${geo.city}, ${geo.country}`;
      } else if (geo && geo.country) {
        location = geo.country;
      } else if (geo && geo.region) {
        location = geo.region;
      }

      return location;
    } catch (error) {
      this.logger.warn(`Failed to lookup location for IP ${ipAddress}:`, error);
      return 'Unknown Location';
    }
  }

  private isPrivateIP(ip: string): boolean {
    const ipParts = ip.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some((part) => isNaN(part))) {
      return false;
    }

    const [a, b] = ipParts;

    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }

  getMetrics(): ISessionMetrics {
    return { ...this.metrics };
  }

  static computeTokenHash(accessToken: string): string {
    return createHash('sha256').update(accessToken).digest('hex').substring(0, 32);
  }
}
