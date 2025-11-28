import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IBetFeedItem, formatProviderGameName } from '@zetik/common';
import { GameTypeEnum, UserBetEntity, UserEntity } from '@zetik/shared-entities';
// import { Cron } from '@nestjs/schedule'; // No longer needed - event-driven updates only
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { TtlMemoryCache } from '../common/cache/ttl-memory-cache';
import { GameSlugEnum, WinnersCategoryEnum } from '../dto/get-top-winners.input';
import { UserPrivacySubscriberService } from '../services/user-privacy-subscriber.service';

export interface TopWinnerItem extends IBetFeedItem {
  place: number;
}

export enum BetFeedTab {
  ALL_BETS = 'all-bets',
  LUCKY_WINNERS = 'lucky-winners',
  ZETIKS = 'zetiks',
}

export interface IBetFeedResponse {
  bets: IBetFeedItem[];
  lastUpdate: string;
  tab: BetFeedTab;
  totalCount: number;
}

export interface IBetFeedDelta {
  tab: BetFeedTab;
  newBets: IBetFeedItem[];
  count: number;
  timestamp: string;
}

export interface IBetFeedMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  lastUpdateDuration: number;
  cacheMisses: number;
  cacheHits: number;
  subscribersCount: number;
  lastBetsCount: number;
}

@Injectable()
export class BetFeedService implements OnModuleInit {
  private readonly logger = new Logger(BetFeedService.name);
  private readonly UPDATE_INTERVAL_SECONDS = 10; // Update every 10 seconds
  private isInitialized = false; // Flag to prevent cron jobs before initialization
  private lastBroadcastByTab: Map<BetFeedTab, { signature: string; timestamp: number }> = new Map();

  // Delta tracking: track last broadcast bet ID per tab for efficient delta queries
  private lastBroadcastBetId: Map<BetFeedTab, string> = new Map();

  // NEW: TTL in-memory caches for user and VIP data (5 minutes TTL)
  private userCache = new TtlMemoryCache<UserEntity | null>(5 * 60);
  private vipCache = new TtlMemoryCache<any>(5 * 60);

  // NEW: Promise-based deduplication for concurrent requests
  private userPromises = new Map<string, Promise<UserEntity | null>>();
  private vipPromises = new Map<string, Promise<any>>();

  // Performance metrics
  private metrics: IBetFeedMetrics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    lastUpdateDuration: 0,
    cacheMisses: 0,
    cacheHits: 0,
    subscribersCount: 0,
    lastBetsCount: 0,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRedis()
    private readonly redisService: Redis,
    private readonly userPrivacySubscriber: UserPrivacySubscriberService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('🚀 BetFeedService initializing...');
    this.logger.log(`⏱️  Update interval: ${this.UPDATE_INTERVAL_SECONDS}s`);
    this.logger.log(`🗄️  User/VIP cache TTL: 5 minutes`);

    // Set up cache invalidation when user privacy changes
    // userCache will be invalidated automatically by UserPrivacySubscriberService
    // New bets will be created with correct isPrivate status from fresh cache
    // Old bets in Redis will eventually be pushed out (50 bet limit per tab)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.userPrivacySubscriber.setInvalidationCaches(this.userCache, (userId: string) =>
      Promise.resolve(),
    );

    // Subscribe to Redis pub/sub for real-time delta updates from main backend
    await this.subscribeToRedisDelta();

    // Initialize Redis cache from database on startup
    await this.initializeRedisCache();

    // Initialize bet feed with optional delay
    await this.initializeBetFeed();
  }

  /**
   * Initialize bet feed with optional delayed start
   */
  private async initializeBetFeed(): Promise<void> {
    try {
      // Wait a bit to ensure database connection is ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check for delayed start configuration
      const delayMinutes = process.env.BET_FEED_START_DELAY_MINUTES;

      this.logger.log(`🔍 BET_FEED_START_DELAY_MINUTES environment variable: "${delayMinutes}"`);

      if (delayMinutes) {
        const delay = parseInt(delayMinutes, 10);

        // Validate delay range (1-60 minutes)
        if (delay >= 1 && delay <= 60) {
          const delayMs = delay * 60 * 1000; // Convert minutes to milliseconds

          this.logger.log(
            `🕒 BetFeedService initialization delayed by ${delay} minutes (${delayMs}ms)`,
          );

          setTimeout(() => {
            this.logger.log(
              `⏰ Starting delayed BetFeedService initialization after ${delay} minutes`,
            );
            void this.performBetFeedInitialization();
          }, delayMs);

          return; // Exit early, initialization will happen after delay
        } else {
          this.logger.warn(
            `Invalid BET_FEED_START_DELAY_MINUTES: ${delayMinutes}. Must be 1-60. Starting immediately.`,
          );
        }
      }

      // No delay or invalid delay - start immediately
      this.logger.log(`🚀 Starting BetFeedService initialization immediately`);
      await this.performBetFeedInitialization();
    } catch (error) {
      this.logger.error('Failed to initialize BetFeedService:', error);
      // Fallback to immediate initialization
      await this.performBetFeedInitialization();
    }
  }

  /**
   * Perform the actual bet feed initialization
   */
  private async performBetFeedInitialization(): Promise<void> {
    this.logger.log('🔄 Performing BetFeedService initialization...');
    // Initial update on startup
    await this.updateBetFeed();
    this.isInitialized = true; // Mark service as initialized after successful initialization
  }

  /**
   * DISABLED: Cron task removed - updates are now 100% event-driven via Redis pub/sub
   * Main backend publishes deltas to Redis when bets are created
   * This service receives deltas and broadcasts via WebSocket
   * No polling needed - real-time updates only
   */
  // @Cron('*/60 * * * * *')  // DISABLED - event-driven updates only
  async updateBetFeed(): Promise<void> {
    // Don't run cron job until service is properly initialized
    if (!this.isInitialized) {
      return;
    }

    // DISABLED: Cron-based updates removed
    // All updates now come from Redis pub/sub (real-time, event-driven)
    return;

    this.metrics.totalUpdates++;

    try {
      // Update all tabs in parallel (batch processing)
      const updatePromises = Object.values(BetFeedTab).map(async (tab) => {
        try {
          // Get last broadcast bet ID for this tab
          const lastBetId = this.lastBroadcastBetId.get(tab);

          // Query ONLY new bets (newer than lastBetId)
          const newBets = await this.fetchNewBets(tab, lastBetId);

          if (newBets.length === 0) {
            // No new bets, skip broadcast
            return { tab, count: 0, queryTime: 0 };
          }

          // Convert to feed items
          const newFeedItems = await this.convertToFeedItems(newBets);

          // Update last broadcast ID (first bet is the newest)
          if (newFeedItems.length > 0) {
            this.lastBroadcastBetId.set(tab, newFeedItems[0].id);
          }

          // Emit delta update (only new bets)
          const deltaData: IBetFeedDelta = {
            tab,
            newBets: newFeedItems,
            count: newFeedItems.length,
            timestamp: new Date().toISOString(),
          };

          this.eventEmitter.emit('bet-feed.delta', deltaData);

          // Also emit old event for backward compatibility (temporary)
          const fullFeed = await this.fetchBetsByTab(tab);
          const fullFeedItems = await this.convertToFeedItems(fullFeed);
          const feedData: IBetFeedResponse = {
            bets: fullFeedItems,
            lastUpdate: new Date().toISOString(),
            tab,
            totalCount: fullFeedItems.length,
          };

          // Debounce duplicate emits per tab
          const signature = `${tab}:${feedData.lastUpdate}`;
          const now = Date.now();
          const lastBroadcast = this.lastBroadcastByTab.get(tab);

          if (
            !lastBroadcast ||
            lastBroadcast.signature !== signature ||
            now - lastBroadcast.timestamp > 50
          ) {
            this.eventEmitter.emit('bet-feed.update', feedData);
            this.lastBroadcastByTab.set(tab, { signature, timestamp: now });
          }

          return { tab, count: newFeedItems.length, queryTime: 0 };
        } catch (error) {
          this.logger.error(`❌ Failed to update ${tab} feed:`, error);
          throw error;
        }
      });

      const results = await Promise.all(updatePromises);

      // Update metrics with total from all tabs
      this.metrics.lastBetsCount = results.reduce((sum, result) => sum + result.count, 0);
      this.metrics.successfulUpdates++;
    } catch (error) {
      this.metrics.failedUpdates++;
      this.logger.error('❌ Failed to update bet feeds:', error);
    } finally {
      // No periodic metrics logs to avoid noise
    }
  }

  /**
   * Manually trigger bet feed update
   */
  async triggerUpdate(): Promise<IBetFeedResponse> {
    this.logger.log('🔄 Manual update triggered');
    await this.updateBetFeed();
    const feedItems = await this.fetchBetsByTab(BetFeedTab.ALL_BETS);
    const bets = await this.convertToFeedItems(feedItems);
    return {
      bets,
      lastUpdate: new Date().toISOString(),
      tab: BetFeedTab.ALL_BETS,
      totalCount: bets.length,
    };
  }

  /**
   * Get performance metrics
   */
  getMetrics(): IBetFeedMetrics {
    return { ...this.metrics };
  }

  /**
   * Set subscriber count (called from gateway)
   */
  setSubscribersCount(count: number): void {
    this.metrics.subscribersCount = count;
  }

  /**
   * Get bet feed data for specific tab
   */
  async getFeedByTab(tab: BetFeedTab): Promise<IBetFeedResponse> {
    const feedItems = await this.fetchBetsByTab(tab);
    const convertedBets = await this.convertToFeedItems(feedItems);

    // Filter private users on output
    const filteredBets = await this.filterPrivateUsers(convertedBets);

    return {
      bets: filteredBets,
      lastUpdate: new Date().toISOString(),
      tab,
      totalCount: filteredBets.length,
    };
  }

  /**
   * Backward-compatible alias for tests and older call sites.
   * Previously returned cached feed; now delegates to live fetch.
   */
  async getCachedFeed(tab: BetFeedTab): Promise<IBetFeedResponse | null> {
    try {
      return await this.getFeedByTab(tab);
    } catch {
      return null;
    }
  }

  // Cache removed: no cache key helper needed

  /**
   * Fetch bets by tab type with proper filtering
   */
  private async fetchBetsByTab(
    tab: BetFeedTab,
  ): Promise<Array<UserBetEntity & { user: UserEntity }>> {
    // Exclude demo bets (betAmount = 0) from public feeds
    let whereClause = `WHERE CAST(bet."betAmount" AS DECIMAL) > 0`;
    const orderClause = `ORDER BY bet."createdAt" DESC`;

    switch (tab) {
      case BetFeedTab.LUCKY_WINNERS:
        whereClause += ` AND CAST(bet.multiplier AS DECIMAL) >= 25.0`; // Restored original 25x
        break;
      case BetFeedTab.ZETIKS:
        // For zetiks, show big WINS (payout amount), not big bets - more exciting!
        whereClause += ` AND CAST(bet."payoutUsd" AS DECIMAL) >= 1000.0`; // Restored original $1000
        break;
      case BetFeedTab.ALL_BETS:
      default:
        // Show all bets (wins, losses, partial losses)
        break;
    }

    const query = `
      SELECT
        bet.game,
        bet."gameName",
        bet."betId",
        bet."userId",
        bet."betAmount",
        bet.asset,
        bet.multiplier,
        bet.payout,
        bet."betAmountUsd",
        bet."payoutUsd",
        bet."createdAt",
        bet."updatedAt",
        bet."originalFiatAmount",
        bet."originalFiatCurrency",
        bet."fiatToUsdRate",
        u.id as user_id,
        u.username as user_username,
        u."displayName" as user_displayName,
        u."avatarUrl" as user_avatarUrl,
        u."isPrivate" as user_isPrivate
      FROM games.user_bets bet
      LEFT JOIN users.users u ON u.id = bet."userId"
      ${whereClause}
      ${orderClause}
      LIMIT 50
    `;

    const results = await this.dataSource.query(query);
    // No per-query debug logs

    // Map SQL results to typed objects
    return results.map((row: any) => ({
      game: row.game,
      gameName: row.gameName,
      betId: row.betId,
      userId: row.userId,
      betAmount: row.betAmount,
      asset: row.asset,
      multiplier: row.multiplier,
      payout: row.payout,
      betAmountUsd: row.betAmountUsd,
      payoutUsd: row.payoutUsd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      originalFiatAmount: row.originalFiatAmount,
      originalFiatCurrency: row.originalFiatCurrency,
      fiatToUsdRate: row.fiatToUsdRate,
      user: row.user_id
        ? ({
            id: row.user_id,
            username: row.user_username,
            displayName: row.user_displayName,
            avatarUrl: row.user_avatarUrl,
            isPrivate: row.user_isPrivate,
          } as UserEntity)
        : null,
    })) as Array<UserBetEntity & { user: UserEntity }>;
  }

  /**
   * Fetch only NEW bets since the last broadcast (delta query)
   * This is the core optimization for delta-based updates
   *
   * @param tab - The bet feed tab to query
   * @param lastBetId - The last broadcast bet ID (optional, for incremental queries)
   * @returns Array of new bets newer than lastBetId
   */
  async fetchNewBets(
    tab: BetFeedTab,
    lastBetId?: string,
  ): Promise<Array<UserBetEntity & { user: UserEntity }>> {
    // Exclude demo bets (betAmount = 0) from public feeds
    let whereClause = `WHERE CAST(bet."betAmount" AS DECIMAL) > 0`;
    const params: any[] = [];

    // Add tab-specific filtering
    switch (tab) {
      case BetFeedTab.LUCKY_WINNERS:
        whereClause += ` AND CAST(bet.multiplier AS DECIMAL) >= 25.0`;
        break;
      case BetFeedTab.ZETIKS:
        whereClause += ` AND CAST(bet."payoutUsd" AS DECIMAL) >= 1000.0`;
        break;
      case BetFeedTab.ALL_BETS:
      default:
        // Show all bets
        break;
    }

    // Add delta filter: only fetch bets newer than lastBetId
    if (lastBetId) {
      // Get the createdAt timestamp of the last broadcast bet
      const lastBetResult = await this.dataSource.query(
        `SELECT "createdAt" FROM games.user_bets WHERE "betId" = $1`,
        [lastBetId],
      );

      if (lastBetResult.length > 0) {
        // Only fetch bets created after the last broadcast bet
        whereClause += ` AND bet."createdAt" > $1`;
        params.push(lastBetResult[0].createdAt);
      }
    }

    const query = `
      SELECT
        bet.game,
        bet."gameName",
        bet."betId",
        bet."userId",
        bet."betAmount",
        bet.asset,
        bet.multiplier,
        bet.payout,
        bet."betAmountUsd",
        bet."payoutUsd",
        bet."createdAt",
        bet."updatedAt",
        bet."originalFiatAmount",
        bet."originalFiatCurrency",
        bet."fiatToUsdRate",
        u.id as user_id,
        u.username as user_username,
        u."displayName" as user_displayName,
        u."avatarUrl" as user_avatarUrl,
        u."isPrivate" as user_isPrivate
      FROM games.user_bets bet
      LEFT JOIN users.users u ON u.id = bet."userId"
      ${whereClause}
      ORDER BY bet."createdAt" DESC
      LIMIT 20
    `;

    const results = await this.dataSource.query(query, params.length > 0 ? params : undefined);

    // Handle case where results might be undefined or null
    if (!results || !Array.isArray(results)) {
      return [];
    }

    // Map SQL results to typed objects
    return results.map((row: any) => ({
      game: row.game,
      gameName: row.gameName,
      betId: row.betId,
      userId: row.userId,
      betAmount: row.betAmount,
      asset: row.asset,
      multiplier: row.multiplier,
      payout: row.payout,
      betAmountUsd: row.betAmountUsd,
      payoutUsd: row.payoutUsd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      originalFiatAmount: row.originalFiatAmount,
      originalFiatCurrency: row.originalFiatCurrency,
      fiatToUsdRate: row.fiatToUsdRate,
      user: row.user_id
        ? ({
            id: row.user_id,
            username: row.user_username,
            displayName: row.user_displayName,
            avatarUrl: row.user_avatarUrl,
            isPrivate: row.user_isPrivate,
          } as UserEntity)
        : null,
    })) as Array<UserBetEntity & { user: UserEntity }>;
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

  /**
   * Convert database bets to feed items (optimized batch processing)
   * Phase 1: Fiat display fields removed from public feed - crypto amounts only
   */
  private async convertToFeedItems(
    bets: Array<UserBetEntity & { user: UserEntity }>,
  ): Promise<IBetFeedItem[]> {
    const feedItems: IBetFeedItem[] = [];

    if (bets.length === 0) {
      return feedItems;
    }

    // Get unique user IDs for VIP status lookup (batch optimization)
    const userIds = [...new Set(bets.map((bet) => bet.user?.id).filter(Boolean))];

    // Get VIP statuses for all users in one batch call (inline query)
    const vipStatuses = await this.getUsersVipStatus(userIds);
    const vipStatusMap = new Map(vipStatuses.map((status) => [status.userId, status]));

    // Batch process all bets without individual logging
    for (const bet of bets) {
      let userInfo: { id: string; userName: string; levelImageUrl: string } | null = null;

      // SQL already masked private users by nulling user fields; if user exists, show it
      if (bet.user) {
        const userVipStatus = vipStatusMap.get(bet.user.id);
        userInfo = {
          id: bet.user.id,
          userName: bet.user.displayName || bet.user.username || 'Anonymous',
          levelImageUrl: userVipStatus?.vipLevelImage || '',
        };
      }

      // Extract gameCode and human-readable name for provider games
      let gameCode: string | undefined;
      let displayName: string = bet.gameName || (bet.game as any);
      if (bet.game === GameTypeEnum.PROVIDER) {
        const formatted = formatProviderGameName(bet.gameName || '');
        displayName = formatted.displayName;
        gameCode = formatted.gameCode;
      }

      // Phase 1: Removed fiat display calculations from public feed
      // Fiat preservation data is now only available in personal bet history
      const feedItem: IBetFeedItem = {
        id: bet.betId,
        game: {
          name: displayName,
          iconName: `${bet.game.toLowerCase()}-icon`, // Generate icon name from game type
          imageName: `${bet.game.toLowerCase()}-image`, // Generate image name from game type
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
        assetImagePath: bet.asset.toLowerCase(), // Use asset name as image path
      };

      feedItems.push(feedItem);
    }

    return feedItems;
  }

  /**
   * Get top winners for a specific game
   */
  async getTopWinners(game: GameTypeEnum, category: WinnersCategoryEnum): Promise<IBetFeedItem[]> {
    let orderClause = 'ORDER BY CAST(bet."payoutUsd" AS DECIMAL) DESC, bet."createdAt" DESC';
    if (category === WinnersCategoryEnum.luckyWins) {
      orderClause =
        'ORDER BY CAST(bet.multiplier AS DECIMAL) DESC, CAST(bet."betAmountUsd" AS DECIMAL) ASC, bet."createdAt" DESC';
    }

    const query = `
      SELECT
        bet.game,
        bet."gameName",
        bet."betId",
        bet."userId",
        bet."betAmount",
        bet.asset,
        bet.multiplier,
        bet.payout,
        bet."betAmountUsd",
        bet."payoutUsd",
        bet."createdAt",
        bet."updatedAt",
        bet."originalFiatAmount",
        bet."originalFiatCurrency",
        bet."fiatToUsdRate",
        u.id as user_id,
        u.username as user_username,
        u."displayName" as user_displayName,
        u."avatarUrl" as user_avatarUrl,
        u."isPrivate" as user_isPrivate
      FROM games.user_bets bet
      LEFT JOIN users.users u ON u.id = bet."userId"
      WHERE bet.game = $1 AND CAST(bet."payoutUsd" AS DECIMAL) > 0
      ${orderClause}
      LIMIT 3
    `;

    const results = await this.dataSource.query(query, [game]);

    const mapped = results.map((row: any) => ({
      game: row.game,
      gameName: row.gameName,
      betId: row.betId,
      userId: row.userId,
      betAmount: row.betAmount,
      asset: row.asset,
      multiplier: row.multiplier,
      payout: row.payout,
      betAmountUsd: row.betAmountUsd,
      payoutUsd: row.payoutUsd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      originalFiatAmount: row.originalFiatAmount,
      originalFiatCurrency: row.originalFiatCurrency,
      fiatToUsdRate: row.fiatToUsdRate,
      user: row.user_id
        ? ({
            id: row.user_id,
            username: row.user_username,
            displayName: row.user_displayName,
            avatarUrl: row.user_avatarUrl,
            isPrivate: row.user_isPrivate,
          } as UserEntity)
        : null,
    })) as Array<UserBetEntity & { user: UserEntity }>;

    return await this.convertToFeedItems(mapped);
  }

  /**
   * Public helper: accept slug and category, map to enum, return 3 items with place
   */
  async getTopWinnersBySlug(
    slug: GameSlugEnum,
    category: WinnersCategoryEnum,
  ): Promise<TopWinnerItem[]> {
    const slugToEnumMap: Record<GameSlugEnum, GameTypeEnum> = {
      crash: GameTypeEnum.CRASH,
      dice: GameTypeEnum.DICE,
      mines: GameTypeEnum.MINES,
      blackjack: GameTypeEnum.BLACKJACK,
      roulette: GameTypeEnum.ROULETTE,
      plinko: GameTypeEnum.PLINKO,
      limbo: GameTypeEnum.LIMBO,
      keno: GameTypeEnum.KENO,
    };

    const items = await this.getTopWinners(slugToEnumMap[slug], category);
    // Filter private users on output
    const filtered = await this.filterPrivateUsers(items);
    return filtered.map((item, index) => ({ place: index + 1, ...item }));
  }

  /**
   * Subscribe to Redis pub/sub channels:
   * - 'user-bet.created': Real-time bet events from main backend/crash service
   * - 'bet-feed-delta': Legacy delta updates (being phased out)
   * - 'bet-feed-user:*': User-specific bet updates
   */
  private async subscribeToRedisDelta(): Promise<void> {
    try {
      this.logger.log('📡 Subscribing to Redis pub/sub channels...');

      // Create a duplicate Redis client for subscription (ioredis requirement)
      const subscriber = this.redisService.duplicate();

      // Subscribe to real-time bet creation events (NEW - primary method)
      await subscriber.subscribe('user-bet.created');

      // Subscribe to bet-feed-delta channel (LEGACY - for backward compatibility)
      await subscriber.subscribe('bet-feed-delta');

      // Subscribe to pattern for user-specific bets (my-bets updates)
      await subscriber.psubscribe('bet-feed-user:*');

      // Handle incoming messages
      subscriber.on('message', (channel: string, message: string) => {
        try {
          if (channel === 'user-bet.created') {
            // NEW: Process real-time bet creation events
            try {
              const bet: UserBetEntity = JSON.parse(message);
              this.logger.debug(`⚡ Received user-bet.created event: betId ${bet.betId}`);

              // Process bet asynchronously with proper error handling
              void (async () => {
                try {
                  await this.handleBetCreated(bet);
                } catch (error) {
                  this.logger.error(
                    `❌ Unhandled error in handleBetCreated for bet ${bet.betId}:`,
                    error,
                  );
                }
              })();
            } catch (error) {
              this.logger.error('❌ Failed to parse user-bet.created message:', error);
            }
          } else if (channel === 'bet-feed-delta') {
            // LEGACY: Handle pre-computed delta updates
            try {
              const deltaData: IBetFeedDelta = JSON.parse(message);
              this.logger.debug(
                `📩 Received delta from Redis: ${deltaData.tab} - ${deltaData.count} new bets`,
              );

              // Emit delta event for WebSocket broadcasting
              this.eventEmitter.emit('bet-feed.delta', deltaData);
            } catch (error) {
              this.logger.error('❌ Failed to parse Redis delta message:', error);
            }
          }
        } catch (error) {
          this.logger.error('❌ Unhandled error in Redis message handler:', error);
        }
      });

      // Handle pattern messages (user-specific bets)
      subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
        try {
          if (pattern === 'bet-feed-user:*') {
            try {
              const userBetData = JSON.parse(message);
              const userId = userBetData.userId;
              const bet = userBetData.bet;

              this.logger.debug(
                `📩 Received user bet from Redis: userId ${userId} - bet ${bet.id}`,
              );

              // Emit user bet event for WebSocket broadcasting to specific user
              this.eventEmitter.emit('bet-feed.user-bet', { userId, bet });
            } catch (error) {
              this.logger.error('❌ Failed to parse Redis user bet message:', error);
            }
          }
        } catch (error) {
          this.logger.error('❌ Unhandled error in Redis pmessage handler:', error);
        }
      });

      // Handle subscription errors with automatic reconnection
      subscriber.on('error', (error) => {
        this.logger.error('❌ Redis subscriber error:', error);
        // Reconnection will be handled by ioredis library automatically
      });

      this.logger.log(
        '✅ Redis pub/sub subscription active (user-bet.created + delta + user bets)',
      );

      // Test event emission to verify EventEmitter2 is working
      this.logger.log('🧪 Testing event emission...');
      this.eventEmitter.emit('bet-feed.delta', {
        tab: BetFeedTab.ALL_BETS,
        newBets: [],
        count: 0,
        timestamp: new Date().toISOString(),
      } as IBetFeedDelta);
      this.logger.log('🧪 Test event emitted');
    } catch (error) {
      this.logger.error('❌ Failed to subscribe to Redis pub/sub:', error);
      // Don't throw - service can still function with fallback cron
    }
  }

  /**
   * Handle bet created event from Redis pub/sub
   * Processes bet, updates cache, and publishes deltas to WebSocket clients
   *
   * This replaces the event-driven logic from BetFeedCacheService in main backend
   * Processing happens here in bet-feed-service (single-instance microservice)
   */
  private async handleBetCreated(bet: UserBetEntity): Promise<void> {
    try {
      this.logger.debug(`⚡ Processing bet created: betId ${bet.betId}`);

      // 1. Convert bet to feed item format
      const feedItem = await this.convertSingleBetToFeedItem(bet);

      // 2. Determine which tabs this bet qualifies for
      const tabs = this.determineQualifyingTabs(bet);

      // 3. Update Redis cache for each qualifying tab (isolated error handling)
      const cacheUpdatePromises = tabs.map(async (tab) => {
        try {
          await this.updateRedisCache(tab, feedItem);
        } catch (error) {
          this.logger.error(`❌ Failed to update cache for tab ${tab}:`, error);
          // Continue with other tabs
        }
      });

      await Promise.allSettled(cacheUpdatePromises);

      // 4. Publish delta events for WebSocket broadcasting (isolated error handling)
      for (const tab of tabs) {
        try {
          this.publishDeltaEvent(tab, [feedItem]);
        } catch (error) {
          this.logger.error(`❌ Failed to publish delta event for tab ${tab}:`, error);
          // Continue with other tabs
        }
      }

      // 5. Publish user-specific bet to "My Bets" room (if user is authenticated)
      if (bet.userId) {
        this.publishUserBetEvent(bet.userId, feedItem);
      }

      this.logger.debug(`✅ Bet ${bet.betId} processed and cached for tabs: ${tabs.join(', ')}`);
    } catch (error) {
      this.logger.error(`❌ Failed to process bet created event for betId ${bet.betId}:`, error);
      // Don't throw - allow other events to continue processing
    }
  }

  /**
   * Determine which tabs a bet qualifies for based on multiplier and payout
   * Skip demo bets (betAmount = 0) from public feeds
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
      await this.redisService.setex(key, 3600, JSON.stringify(trimmedBets));

      this.logger.debug(`✅ Redis cache updated for ${tab}: added bet ${feedItem.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to update Redis cache for ${tab}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Publish delta update event for WebSocket broadcasting
   * Emits to EventEmitter2 which triggers WebSocket gateway
   */
  private publishDeltaEvent(tab: BetFeedTab, newBets: IBetFeedItem[]): void {
    try {
      const deltaData: IBetFeedDelta = {
        tab,
        newBets,
        count: newBets.length,
        timestamp: new Date().toISOString(),
      };

      // Emit to EventEmitter2 for WebSocket broadcasting
      this.eventEmitter.emit('bet-feed.delta', deltaData);

      this.logger.debug(`📡 Published delta event for ${tab}: ${newBets.length} new bets`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish delta event for ${tab}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Publish user-specific bet event for "My Bets"
   * Emits to EventEmitter2 for WebSocket broadcasting to specific user
   */
  private publishUserBetEvent(userId: string, bet: IBetFeedItem): void {
    try {
      const userBetData = {
        userId,
        bet,
        timestamp: new Date().toISOString(),
      };

      // Emit to EventEmitter2 for WebSocket broadcasting to user
      this.eventEmitter.emit('bet-feed.user-bet', userBetData);

      this.logger.debug(`📡 Published user bet event for userId ${userId}: bet ${bet.id}`);
    } catch (error) {
      this.logger.error(`❌ Failed to publish user bet event for userId ${userId}:`, error);
      // Don't throw - graceful degradation
    }
  }

  /**
   * Get user data from cache or database with TTL expiration and promise deduplication
   * Prevents race conditions where multiple concurrent requests trigger duplicate DB queries
   */
  private async getUserFromCache(userId: string): Promise<UserEntity | null> {
    // Check cache first
    const cached = this.userCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

    // Check if request is already in progress (promise deduplication)
    const existingPromise = this.userPromises.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new promise for this request
    const promise = this.fetchUserFromDatabase(userId);
    this.userPromises.set(userId, promise);

    try {
      const user = await promise;
      return user;
    } finally {
      // Always clean up the promise
      this.userPromises.delete(userId);
    }
  }

  /**
   * Fetch user from database and cache the result
   */
  private async fetchUserFromDatabase(userId: string): Promise<UserEntity | null> {
    try {
      const userResult = await this.dataSource.query(
        `SELECT id, username, "displayName", "avatarUrl", "isPrivate" FROM users.users WHERE id = $1`,
        [userId],
      );

      const user = userResult[0] || null;
      this.userCache.set(userId, user);

      return user;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch user ${userId} from database:`, error);
      return null;
    }
  }

  /**
   * Get VIP status from cache or database with TTL expiration and promise deduplication
   * Prevents race conditions where multiple concurrent requests trigger duplicate DB queries
   */
  private async getVipStatusFromCache(userId: string): Promise<any> {
    // Check cache first
    const cached = this.vipCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

    // Check if request is already in progress (promise deduplication)
    const existingPromise = this.vipPromises.get(userId);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new promise for this request
    const promise = this.fetchVipStatusFromDatabase(userId);
    this.vipPromises.set(userId, promise);

    try {
      const vipStatus = await promise;
      return vipStatus;
    } finally {
      // Always clean up the promise
      this.vipPromises.delete(userId);
    }
  }

  /**
   * Fetch VIP status from database and cache the result
   */
  private async fetchVipStatusFromDatabase(userId: string): Promise<any> {
    try {
      const vipStatuses = await this.getUsersVipStatus([userId]);
      const vipStatus = vipStatuses[0];

      this.vipCache.set(userId, vipStatus);

      return vipStatus;
    } catch (error) {
      this.logger.error(`❌ Failed to fetch VIP status for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Convert a single bet to feed item format (for real-time event processing)
   * Uses cached user and VIP data to avoid N+1 queries
   *
   * PERFORMANCE IMPROVEMENT:
   * Previously made 2 database queries per bet. Now uses 5-minute cache:
   * 1. User lookup query (lines 947-951) - fetches username, displayName, isPrivate
   * 2. VIP status query (line 957) - fetches VIP level and image URL
   *
   * Under high load (100+ bets/second), this results in 200+ database queries/second
   * for bet feed processing alone, which impacts database performance and latency.
   *
   * PROPOSED SOLUTION:
   * Include user information directly in the UserBetEntity when published to Redis:
   * - Modify UserBetService.publishRawBetToRedis() to include user data
   * - Add fields: userName, userDisplayName, userIsPrivate, userVipLevel, userVipImageUrl
   * - Remove database queries from this function entirely
   *
   * IMPLEMENTATION PLAN:
   * 1. Update UserBetService to fetch user + VIP data before publishing to Redis
   * 2. Extend UserBetEntity interface to include denormalized user fields
   * 3. Remove database queries from convertSingleBetToFeedItem()
   * 4. Update convertToFeedItems() to use the same denormalized approach
   *
   * IMPACT:
   * - Reduces bet feed database load by ~200 queries/second at peak
   * - Improves bet feed latency from ~50ms to ~5ms per bet
   * - Scales better with increased bet volume
   *
   * WHY NOT NOW:
   * Too close to launch. This optimization requires changes to:
   * - UserBetService (main backend)
   * - UserBetEntity interface (shared-entities)
   * - BetFeedService (this file)
   * - Testing across all components
   * Risk of introducing bugs before launch is too high.
   * Schedule for post-launch optimization sprint.
   */
  private async convertSingleBetToFeedItem(
    bet: UserBetEntity & { user?: UserEntity },
  ): Promise<IBetFeedItem> {
    let userInfo: { id: string; userName: string; levelImageUrl: string } | null = null;

    // If bet has userId, fetch user and VIP status from cache
    if (bet.userId) {
      // Get user from cache (with fallback to DB)
      const user = bet.user || (await this.getUserFromCache(bet.userId));

      // ALWAYS store full user data in Redis, privacy filtering happens on output
      if (user) {
        // Get VIP status from cache
        const userVipStatus = await this.getVipStatusFromCache(user.id);

        userInfo = {
          id: user.id,
          userName: user.displayName || user.username || 'Anonymous',
          levelImageUrl: userVipStatus?.vipLevelImage || '',
        };
      }
    }

    const feedItem: IBetFeedItem = {
      id: bet.betId,
      game: {
        name: bet.gameName || bet.game,
        iconName: `${bet.game.toLowerCase()}-icon`,
        imageName: `${bet.game.toLowerCase()}-image`,
        gameType: bet.game,
      },
      user: userInfo
        ? {
            id: userInfo.id,
            name: userInfo.userName,
            imageName: userInfo.levelImageUrl || undefined,
          }
        : null,
      // Handle createdAt as either Date object (from DB) or string (from Redis pub/sub JSON)
      time: bet.createdAt instanceof Date ? bet.createdAt.toISOString() : bet.createdAt,
      bet: bet.betAmount.toString(),
      multiplier: bet.multiplier?.toString() || '0',
      payout: bet.payout?.toString() || '0',
      cryptoAsset: bet.asset,
      assetImagePath: bet.asset.toLowerCase(),
    };

    return feedItem;
  }

  /**
   * Initialize Redis cache on service startup
   * Populates cache from database for all tabs
   *
   * Note: Ongoing cache updates are event-driven via Redis pub/sub (handleBetCreated)
   * This initialization is only for populating cache on service startup
   */
  private async initializeRedisCache(): Promise<void> {
    try {
      this.logger.log('🔄 Initializing Redis cache from database...');

      const tabs = Object.values(BetFeedTab);

      for (const tab of tabs) {
        const bets = await this.fetchBetsByTab(tab);
        const feedItems = await this.convertToFeedItems(bets);

        const key = `bet-feed:${tab}`;
        await this.redisService.setex(key, 3600, JSON.stringify(feedItems));

        this.logger.log(`✅ Initialized ${tab} cache with ${feedItems.length} bets`);
      }

      this.logger.log('✅ Redis cache initialization complete');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Redis cache:', error);
      // Don't throw - service can still function with database queries
    }
  }

  /**
   * Filter private users on output
   * Redis stores full user data, we mask it only when returning to client
   * Checks fresh isPrivate status from userCache (no SQL overhead)
   */
  async filterPrivateUsers(feedItems: IBetFeedItem[]): Promise<IBetFeedItem[]> {
    return Promise.all(
      feedItems.map(async (item) => {
        if (!item.user?.id) {
          return item;
        }

        const user = await this.getUserFromCache(item.user.id);

        if (user?.isPrivate) {
          return { ...item, user: null };
        }

        return item;
      }),
    );
  }

  // Intentionally not logging metrics periodically to avoid noise
}
