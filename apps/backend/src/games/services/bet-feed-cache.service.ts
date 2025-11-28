import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { IBetFeedItem, formatProviderGameName } from '@zetik/common';
import { GameTypeEnum, UserBetEntity, UserEntity } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { RedisService } from '../../common/services/redis.service';

/**
 * Bet Feed Tabs (matches bet-feed-service)
 */
export enum BetFeedTab {
  ALL_BETS = 'all-bets',
  LUCKY_WINNERS = 'lucky-winners',
  ZETIKS = 'zetiks',
}

/**
 * Bet Feed Delta Event (published to Redis)
 */
export interface IBetFeedDelta {
  tab: BetFeedTab;
  newBets: IBetFeedItem[];
  count: number;
  timestamp: string;
}

/**
 * BetFeedCacheService
 *
 * Handles event-driven cache updates in the main backend.
 * Listens to 'user-bet.created' events, updates Redis cache, and publishes
 * delta events via Redis pub/sub for bet-feed-service to broadcast via WebSocket.
 *
 * Architecture:
 * - Main Backend: Handles events + cache updates (this service)
 * - Bet Feed Service: WebSocket broadcasting only (subscribes to Redis pub/sub)
 * - Communication: Redis pub/sub for real-time updates
 */
@Injectable()
export class BetFeedCacheService {
  private readonly logger = new Logger(BetFeedCacheService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Event-Driven Real-Time Update Handler
   * DISABLED: UserBetService now handles Redis publishing directly for all microservices
   * This avoids duplicates and ensures crash service bets are included
   *
   * Listens for user-bet.created events and updates Redis cache + publishes to bet-feed-service
   * Provides <50ms latency from bet creation to cache update
   */
  // @OnEvent('user-bet.created') // DISABLED - UserBetService handles this now
  async handleBetCreated(bet: UserBetEntity): Promise<void> {
    try {
      this.logger.debug(`⚡ Event received: user-bet.created for betId ${bet.betId}`);

      // 1. Convert bet to feed item format
      const feedItem = await this.convertSingleBetToFeedItem(bet);

      // 2. Determine which tabs this bet qualifies for
      const tabs = this.determineQualifyingTabs(bet);

      // 3. Update Redis cache for each qualifying tab
      for (const tab of tabs) {
        await this.updateRedisCache(tab, feedItem);
      }

      // 4. Publish Redis pub/sub event for bet-feed-service WebSocket broadcasting
      for (const tab of tabs) {
        await this.publishDelta(tab, [feedItem]);
      }

      // 5. Publish user-specific bet to "My Bets" room (if user is authenticated)
      if (bet.userId) {
        await this.publishUserBet(bet.userId, feedItem);
      }

      this.logger.debug(`✅ Bet ${bet.betId} processed and cached for tabs: ${tabs.join(', ')}`);
    } catch (error) {
      this.logger.error(`❌ Failed to handle bet created event for betId ${bet.betId}:`, error);
      // Don't throw - allow other events to continue processing
    }
  }

  /**
   * Determine which tabs a bet qualifies for based on multiplier and payout
   */
  private determineQualifyingTabs(bet: UserBetEntity): BetFeedTab[] {
    // Skip demo bets (betAmount = 0) entirely for public feeds
    if (parseFloat(bet.betAmount) === 0) {
      return []; // Don't add to any public feed
    }

    const tabs: BetFeedTab[] = [BetFeedTab.ALL_BETS];

    // Lucky Winners: multiplier >= 25x
    if (parseFloat(bet.multiplier) >= 25.0) {
      tabs.push(BetFeedTab.LUCKY_WINNERS);
    }

    // Zetiks: payout >= $1000 USD
    if (parseFloat(bet.payoutUsd) >= 1000.0) {
      tabs.push(BetFeedTab.ZETIKS);
    }

    return tabs;
  }

  /**
   * Update Redis cache for a specific tab
   * Prepends new bet and trims to 50 items
   */
  private async updateRedisCache(tab: BetFeedTab, feedItem: IBetFeedItem): Promise<void> {
    try {
      const key = `bet-feed:${tab}`;

      // Get current cache
      const cached = await this.redisService.get(key);
      const currentBets: IBetFeedItem[] = cached ? JSON.parse(cached) : [];

      // Prepend new bet
      const updatedBets = [feedItem, ...currentBets];

      // Trim to 50
      const trimmedBets = updatedBets.slice(0, 50);

      // Store back in Redis with 1 hour TTL
      await this.redisService.setWithExpiry(key, JSON.stringify(trimmedBets), 3600);

      this.logger.debug(`✅ Redis cache updated for ${tab}: added bet ${feedItem.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to update Redis cache for ${tab}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Publish delta update via Redis pub/sub for bet-feed-service
   * Emits to 'bet-feed-delta' channel
   */
  private async publishDelta(tab: BetFeedTab, newBets: IBetFeedItem[]): Promise<void> {
    try {
      const deltaData: IBetFeedDelta = {
        tab,
        newBets,
        count: newBets.length,
        timestamp: new Date().toISOString(),
      };

      // Publish to Redis pub/sub channel
      const redis = this.redisService.getClient();
      await redis.publish('bet-feed-delta', JSON.stringify(deltaData));

      this.logger.debug(`📡 Published delta to Redis for ${tab}: ${newBets.length} new bets`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish delta for ${tab}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Publish user-specific bet via Redis pub/sub for "My Bets"
   * Emits to 'bet-feed-user:{userId}' channel for user-specific updates
   */
  private async publishUserBet(userId: string, bet: IBetFeedItem): Promise<void> {
    try {
      const userBetData = {
        userId,
        bet,
        timestamp: new Date().toISOString(),
      };

      // Publish to user-specific Redis pub/sub channel
      const redis = this.redisService.getClient();
      await redis.publish(`bet-feed-user:${userId}`, JSON.stringify(userBetData));

      this.logger.debug(`📡 Published user bet to Redis for userId ${userId}: bet ${bet.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish user bet for userId ${userId}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Convert a single bet to feed item format (for event processing)
   * Fetches VIP status for the user
   */
  private async convertSingleBetToFeedItem(
    bet: UserBetEntity & { user?: UserEntity },
  ): Promise<IBetFeedItem> {
    let userInfo: { id: string; userName: string; levelImageUrl: string } | null = null;

    // If bet has userId, fetch user and VIP status
    if (bet.userId) {
      // Get user if not already loaded
      let user = bet.user;
      if (!user) {
        const userResult = await this.dataSource.query(
          `SELECT id, username, "displayName", "avatarUrl", "isPrivate" FROM users.users WHERE id = $1`,
          [bet.userId],
        );
        user = userResult[0] || null;
      }

      // Only show user info if not private
      if (user && !user.isPrivate) {
        // Get VIP status
        const vipStatuses = await this.getUsersVipStatus([user.id]);
        const userVipStatus = vipStatuses[0];

        userInfo = {
          id: user.id,
          userName: user.displayName || user.username || 'Anonymous',
          levelImageUrl: userVipStatus?.vipLevelImage || '',
        };
      }
    }

    // Extract gameCode for provider games
    let gameCode: string | undefined;
    let displayName: string = bet.gameName || (bet.game as string);
    if (bet.game === GameTypeEnum.PROVIDER) {
      const formatted = formatProviderGameName(bet.gameName || '');
      displayName = formatted.displayName;
      gameCode = formatted.gameCode;
    }

    const feedItem: IBetFeedItem = {
      id: bet.betId,
      game: {
        name: displayName,
        iconName: `${bet.game.toLowerCase()}-icon`,
        imageName: `${bet.game.toLowerCase()}-image`,
        gameType: bet.game,
        gameCode: gameCode,
      },
      user: userInfo
        ? {
            id: userInfo.id,
            name: userInfo.userName,
            imageName: userInfo.levelImageUrl || undefined,
          }
        : null,
      time: bet.createdAt.toISOString(),
      bet: bet.betAmount.toString(),
      multiplier: bet.multiplier?.toString() || '0',
      payout: bet.payout?.toString() || '0',
      cryptoAsset: bet.asset,
      assetImagePath: bet.asset.toLowerCase(),
    };

    return feedItem;
  }

  /**
   * Get VIP status for multiple users in one batch query
   */
  private async getUsersVipStatus(
    userIds: string[],
  ): Promise<Array<{ userId: string; vipLevel: number; vipLevelImage: string }>> {
    if (!userIds.length) return [];

    const results = await this.dataSource.query(
      `
      SELECT
        uvs."userId",
        uvs."currentVipLevel" as "vipLevel",
        vt."imageUrl" as "vipLevelImage"
      FROM bonus.bonuses_user_vip_status uvs
      LEFT JOIN bonus.bonuses_vip_tiers vt ON uvs."currentVipLevel" = vt.level
      WHERE uvs."userId" = ANY($1)
    `,
      [userIds],
    );

    return results || [];
  }
}
