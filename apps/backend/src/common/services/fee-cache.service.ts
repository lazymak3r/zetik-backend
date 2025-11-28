import { Injectable, Logger } from '@nestjs/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { RedisService } from './redis.service';

@Injectable()
export class FeeCacheService {
  private readonly logger = new Logger(FeeCacheService.name);
  private readonly CACHE_TTL = 5 * 60; // 5 minutes in seconds
  // Remove unused MAX_CACHE_ENTRIES since we're using Redis TTL
  // private readonly MAX_CACHE_ENTRIES = 100;

  private readonly CACHE_KEY_PREFIX = 'fee:estimate:';

  constructor(private readonly redisService: RedisService) {}

  async get(
    asset: AssetTypeEnum,
  ): Promise<{ fee: string; isFromApi: boolean; cachedAt: Date } | null> {
    try {
      const key = `${this.CACHE_KEY_PREFIX}${asset}`;
      const cached = await this.redisService.get(key);

      if (!cached) return null;

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        cachedAt: new Date(parsed.cachedAt),
      };
    } catch (error) {
      this.logger.error(`Failed to get fee cache for ${asset}:`, error);
      return null;
    }
  }

  async set(asset: AssetTypeEnum, fee: string, isFromApi: boolean): Promise<void> {
    try {
      const key = `${this.CACHE_KEY_PREFIX}${asset}`;
      const value = {
        fee,
        isFromApi,
        cachedAt: new Date().toISOString(),
      };

      await this.redisService.set(key, JSON.stringify(value), this.CACHE_TTL);
    } catch (error) {
      this.logger.error(`Failed to set fee cache for ${asset}:`, error);
    }
  }

  async invalidate(asset: AssetTypeEnum): Promise<void> {
    try {
      const key = `${this.CACHE_KEY_PREFIX}${asset}`;
      await this.redisService.del(key);
    } catch (error) {
      this.logger.error(`Failed to invalidate fee cache for ${asset}:`, error);
    }
  }

  async invalidateAll(): Promise<void> {
    try {
      let cursor = '0';
      let totalDeleted = 0;

      do {
        // Remove the extra parameters - just pass cursor, pattern, and count
        const result = await this.redisService.scan(
          cursor,
          `${this.CACHE_KEY_PREFIX}*`,
          100, // count as number
        );

        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          await Promise.all(keys.map((key) => this.redisService.del(key)));
          totalDeleted += keys.length;
        }
      } while (cursor !== '0');

      this.logger.log(`Invalidated ${totalDeleted} fee cache entries`);
    } catch (error) {
      this.logger.error('Failed to invalidate all fee caches:', error);
    }
  }

  async getStats(): Promise<{ totalEntries: number }> {
    try {
      let cursor = '0';
      let totalEntries = 0;

      do {
        const result = await this.redisService.scan(
          cursor,
          `${this.CACHE_KEY_PREFIX}*`,
          100, // count as number
        );

        cursor = result[0];
        totalEntries += result[1].length;
      } while (cursor !== '0');

      return { totalEntries };
    } catch (error) {
      this.logger.error('Failed to get fee cache stats:', error);
      return { totalEntries: 0 };
    }
  }
}
