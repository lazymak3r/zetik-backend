import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Redis } from 'ioredis';
import { QueryRunner } from 'typeorm';
import { RedisService } from '../services/redis.service';

/**
 * AffiliateCommissionService
 *
 * WHY SEPARATE SERVICE:
 * - Extracted to common/affiliate to avoid circular dependencies between modules
 * - Commission logic is reused across BalanceService and SportsbookService
 * - Prevents code duplication (DRY principle)
 *
 * USAGE (4 call sites):
 * 1. BalanceService - single BET operation (casino games)
 * 2. BalanceService - batch [BET, WIN] operations (casino games)
 * 3. SportsbookService (BetbyService) - WIN status (after settlement)
 * 4. SportsbookService (BetbyService) - LOST status (after settlement)
 *
 * IMPORTANT: Sportsbook commission on WIN/LOST only, NOT on bet placement
 * Reason: Sportsbook bets can be cancelled/voided before settlement
 * BalanceService filters sportsbook bets via metadata.source check to prevent double commission
 *
 * ARCHITECTURE:
 * - Direct write to affiliate_wallets (no intermediate pending table)
 * - LRU cache (1000 entries) for userId → affiliateId mapping
 * - Self-contained error handling (doesn't throw, doesn't disrupt bet flow)
 * - Automatic skip if user has no affiliate campaign
 */

const EXPECTED_PROFIT_DIVISOR = 2;
const COMMISSION_RATE = 0.1;
const LRU_CACHE_SIZE = 1000;

interface ICacheEntry {
  affiliateId: string | null;
  campaignCode: string | null;
  timestamp: number;
}

@Injectable()
export class AffiliateCommissionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AffiliateCommissionService.name);
  private readonly affiliateCache = new Map<string, ICacheEntry>();
  private readonly CACHE_INVALIDATION_CHANNEL = 'affiliate:cache:invalidate';
  private subscriber: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit(): Promise<void> {
    // Subscribe to cache invalidation events from Redis
    try {
      await this.subscribeToCacheInvalidation();
      this.logger.log('Subscribed to affiliate cache invalidation channel');
    } catch (error) {
      this.logger.error(
        'Failed to subscribe to cache invalidation channel',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async subscribeToCacheInvalidation(): Promise<void> {
    // Use a separate connection for pub/sub
    this.subscriber = this.redisService.getClient().duplicate();
    await this.subscriber.connect();

    // Subscribe to cache invalidation channel
    await this.subscriber.subscribe(this.CACHE_INVALIDATION_CHANNEL);

    // Listen for messages on the channel
    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        if (channel !== this.CACHE_INVALIDATION_CHANNEL) {
          return;
        }
        if (!message) {
          this.logger.warn('Received empty message on cache invalidation channel');
          return;
        }
        const data = JSON.parse(message);
        const invalidatedCount = this.invalidateCacheByCompaignCode(data.campaignCode);
        this.logger.log(
          `Cache invalidation received via Redis for campaign ${data.campaignCode}. Invalidated ${invalidatedCount} entries.`,
        );
      } catch (error) {
        this.logger.error(
          'Failed to process cache invalidation message',
          error instanceof Error ? error.message : String(error),
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(this.CACHE_INVALIDATION_CHANNEL);
        await this.subscriber.quit();
        this.logger.log('Unsubscribed from affiliate cache invalidation channel');
      } catch (error) {
        this.logger.error(
          'Failed to cleanup Redis subscriber',
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  async accumulateCommission(
    userId: string,
    asset: AssetTypeEnum,
    betAmount: string,
    houseEdge: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    try {
      // Get affiliateId and campaignId from cache or database
      const affiliateData = await this.getAffiliateData(userId, queryRunner);

      if (!affiliateData) {
        // User has no affiliate campaign, skip commission
        return;
      }

      const { affiliateId, campaignCode } = affiliateData;

      // Calculate commission: (houseEdge * wagered / 2) * commissionRate
      const expectedProfit = new BigNumber(betAmount)
        .multipliedBy(houseEdge / 100)
        .dividedBy(EXPECTED_PROFIT_DIVISOR);

      const commission = expectedProfit
        .multipliedBy(COMMISSION_RATE)
        .decimalPlaces(8, BigNumber.ROUND_DOWN);

      if (commission.isLessThanOrEqualTo(0)) {
        return;
      }

      // Write to both affiliate_wallets and affiliate_earnings atomically
      const commissionStr = commission.toFixed(8);

      await queryRunner.query(
        `
          INSERT INTO affiliate.affiliate_wallets 
            ("userId", asset, "totalEarned", balance, wagered, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $3, $4, NOW(), NOW())
          ON CONFLICT ("userId", asset) DO UPDATE SET
            "totalEarned" = affiliate_wallets."totalEarned"::decimal + EXCLUDED."totalEarned"::decimal,
            balance = affiliate_wallets.balance::decimal + EXCLUDED.balance::decimal,
            wagered = affiliate_wallets.wagered::decimal + EXCLUDED.wagered::decimal,
            "updatedAt" = NOW()
        `,
        [affiliateId, asset, commissionStr, betAmount],
      );

      await queryRunner.query(
        `
          INSERT INTO affiliate.affiliate_earnings 
            ("referredUserId", asset, "affiliateId", "campaignCode", earned, wagered)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT ("referredUserId", asset) DO UPDATE SET
            earned = affiliate_earnings.earned::decimal + EXCLUDED.earned::decimal,
            wagered = affiliate_earnings.wagered::decimal + EXCLUDED.wagered::decimal
        `,
        [userId, asset, affiliateId, campaignCode, commissionStr, betAmount],
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error('Failed to accumulate affiliate commission', {
        userId,
        asset,
        betAmount,
        houseEdge,
        error: errorMessage,
        stack: errorStack,
      });

      // Re-throw to allow caller to handle (rollback transaction if needed)
      throw error;
    }
  }

  private async getAffiliateData(
    userId: string,
    queryRunner: QueryRunner,
  ): Promise<{ affiliateId: string; campaignCode: string } | null> {
    // Check LRU cache first
    const cached = this.affiliateCache.get(userId);
    if (cached) {
      // Update access order for LRU
      this.updateLRU(userId);
      // Only return if all required fields are present
      if (cached.affiliateId && cached.campaignCode) {
        return {
          affiliateId: cached.affiliateId,
          campaignCode: cached.campaignCode,
        };
      }
      // If cached as null, return null
      if (!cached.affiliateId) {
        return null;
      }
    }

    // Query database using raw SQL to avoid TypeORM alias issues
    const result = await queryRunner.query(
      `
      SELECT 
        ac."userId" as "affiliateId",
        ac.code as "campaignCode"
      FROM users.users u
      INNER JOIN affiliate.affiliate_campaigns ac ON u."affiliateCampaignId"::uuid = ac.id
      WHERE u.id = $1
      `,
      [userId],
    );

    if (!result || result.length === 0) {
      this.addToCache(userId, null, null);
      return null;
    }

    const row = result[0];

    const affiliateData = {
      affiliateId: row.affiliateId,
      campaignCode: row.campaignCode,
    };

    // Add to LRU cache
    this.addToCache(userId, row.affiliateId, row.campaignCode);

    return affiliateData;
  }

  private updateLRU(userId: string): void {
    // Map preserves insertion order in ES6+
    // Delete and re-insert to move to end (most recently used)
    const entry = this.affiliateCache.get(userId);
    if (entry) {
      this.affiliateCache.delete(userId);
      this.affiliateCache.set(userId, entry);
    }
  }

  private addToCache(
    userId: string,
    affiliateId: string | null,
    campaignCode: string | null,
  ): void {
    // If entry already exists, update it (will move to end via delete+set)
    if (this.affiliateCache.has(userId)) {
      this.affiliateCache.delete(userId);
      this.affiliateCache.set(userId, {
        affiliateId,
        campaignCode,
        timestamp: Date.now(),
      });
      return;
    }

    // If cache is full, remove least recently used (first entry in Map)
    if (this.affiliateCache.size >= LRU_CACHE_SIZE) {
      const firstKey = this.affiliateCache.keys().next().value;
      if (firstKey) {
        this.affiliateCache.delete(firstKey);
      }
    }

    // Add new entry (will be at the end)
    this.affiliateCache.set(userId, {
      affiliateId,
      campaignCode,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache entry for a specific user
   * Call this when user's affiliateCampaignId changes
   */
  invalidateCacheEntry(userId: string): void {
    const wasDeleted = this.affiliateCache.delete(userId);
    if (wasDeleted) {
      this.logger.verbose(`Cache invalidated for user ${userId}`);
    }
  }

  /**
   * Invalidate all cache entries for users under a specific campaign
   * Call this when a campaign is deleted or modified
   * Iterates through cache and removes entries matching the campaign
   */
  invalidateCacheByCompaignCode(campaignCode: string): number {
    let invalidatedCount = 0;
    const keysToDelete: string[] = [];

    // Find all cache entries with matching campaign code
    for (const [userId, entry] of this.affiliateCache.entries()) {
      if (entry.campaignCode === campaignCode) {
        keysToDelete.push(userId);
        invalidatedCount++;
      }
    }

    // Delete all matching entries
    keysToDelete.forEach((userId) => {
      this.affiliateCache.delete(userId);
    });

    if (invalidatedCount > 0) {
      this.logger.log(`Invalidated ${invalidatedCount} cache entries for campaign ${campaignCode}`);
    }

    return invalidatedCount;
  }

  getCacheStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.affiliateCache.size,
      maxSize: LRU_CACHE_SIZE,
    };
  }

  clearCache(): void {
    this.affiliateCache.clear();
    this.logger.log('Affiliate commission cache cleared');
  }
}
