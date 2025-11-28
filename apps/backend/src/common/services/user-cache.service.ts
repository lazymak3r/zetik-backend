import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Centralized service for managing user-related cache operations
 */
@Injectable()
export class UserCacheService {
  private readonly logger = new Logger(UserCacheService.name);

  // Cache key prefixes - centralized constants
  private readonly JWT_CACHE_KEY_PREFIX = 'jwt-user:';
  private readonly UNIFIED_PROFILE_CACHE_KEY_PREFIX = 'unified-profile:';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Invalidate all user-related caches
   * This includes JWT cache and unified profile cache
   */
  async invalidateAllUserCaches(userId: string): Promise<void> {
    try {
      const jwtCacheKey = this.getJwtCacheKey(userId);
      const unifiedProfileCacheKey = this.getUnifiedProfileCacheKey(userId);

      await Promise.all([
        this.redisService.del(jwtCacheKey),
        this.redisService.del(unifiedProfileCacheKey),
      ]);

      this.logger.log(`Invalidated all user caches for user ${userId}`);
    } catch (error) {
      this.logger.warn('Failed to invalidate user caches', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Invalidate only JWT cache for user
   */
  async invalidateJwtCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getJwtCacheKey(userId);
      await this.redisService.del(cacheKey);
      this.logger.debug(`Invalidated JWT cache for user ${userId}`);
    } catch (error) {
      this.logger.warn('Failed to invalidate JWT cache', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Invalidate only unified profile cache for user
   */
  async invalidateUnifiedProfileCache(userId: string): Promise<void> {
    try {
      const cacheKey = this.getUnifiedProfileCacheKey(userId);
      await this.redisService.del(cacheKey);
      this.logger.debug(`Invalidated unified profile cache for user ${userId}`);
    } catch (error) {
      this.logger.warn('Failed to invalidate unified profile cache', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get JWT cache key for user
   */
  getJwtCacheKey(userId: string): string {
    return `${this.JWT_CACHE_KEY_PREFIX}${userId}`;
  }

  /**
   * Get unified profile cache key for user
   */
  getUnifiedProfileCacheKey(userId: string): string {
    return `${this.UNIFIED_PROFILE_CACHE_KEY_PREFIX}${userId}`;
  }
}
