import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { TtlMemoryCache } from '../common/cache/ttl-memory-cache';

/**
 * UserPrivacySubscriberService
 *
 * Single Responsibility: Subscribe to user privacy changes and invalidate local cache
 *
 * Decouples cache invalidation logic from BetFeedService, making it:
 * - Testable (easy to mock Redis subscription)
 * - Reusable (can be used by other services)
 * - Maintainable (isolated from bet feed logic)
 *
 * Subscribes to: 'user.privacy-changed' Redis pub/sub channel
 * Published by: Backend UserService when user updates privacy
 */
@Injectable()
export class UserPrivacySubscriberService implements OnModuleInit {
  private readonly logger = new Logger(UserPrivacySubscriberService.name);
  private readonly CHANNEL = 'user.privacy-changed';
  private subscriber: Redis | null = null;

  constructor(
    @InjectRedis()
    private readonly redisService: Redis,
  ) {}

  /**
   * Initialize Redis subscription on module startup
   */
  async onModuleInit(): Promise<void> {
    await this.subscribeToPrivacyChanges();
  }

  /**
   * Subscribe to user privacy changes from Redis pub/sub
   * Invalidates cached user data when privacy status changes
   */
  private async subscribeToPrivacyChanges(): Promise<void> {
    try {
      this.logger.log(`Subscribing to privacy change events on channel: ${this.CHANNEL}`);

      // Create a duplicate Redis client for subscription (ioredis requirement)
      this.subscriber = this.redisService.duplicate();

      // Subscribe to privacy change events
      await this.subscriber.subscribe(this.CHANNEL);

      // Handle incoming privacy change events
      this.subscriber.on('message', (channel: string, message: string) => {
        if (channel === this.CHANNEL) {
          void (async () => {
            try {
              await this.handlePrivacyChangeMessage(message);
            } catch (error) {
              this.logger.error('Failed to handle privacy change message:', error);
            }
          })();
        }
      });

      // Handle subscription errors with automatic reconnection
      this.subscriber.on('error', (error) => {
        this.logger.error(`Redis subscriber error on ${this.CHANNEL}:`, error);
        // ioredis handles reconnection automatically
      });

      this.logger.log(`Successfully subscribed to privacy change events`);
    } catch (error) {
      this.logger.error('Failed to subscribe to privacy changes:', error);
      // Don't throw - service can still function, cache will be invalidated on expiry
    }
  }

  /**
   * Handle incoming privacy change message
   * Parses the message and triggers cache invalidation
   */
  private async handlePrivacyChangeMessage(message: string): Promise<void> {
    const data = JSON.parse(message);
    const { userId, isPrivate, changedAt } = data;

    // Invalidate in-memory user cache (contains isPrivate status)
    // VIP cache is independent and doesn't need invalidation on privacy change
    if (this.userCache) {
      this.userCache.delete(userId);
    }

    // Invalidate bet-feed Redis caches (remove user's bets from all tabs)
    await this.invalidateBetFeedCaches(userId);

    this.logger.log(
      `Invalidated user cache for ${userId}: privacy changed to ${isPrivate} at ${changedAt}`,
    );
  }

  /**
   * References to caches managed by BetFeedService
   * Set by BetFeedService via setInvalidationCaches()
   */
  private userCache: TtlMemoryCache<any> | null = null;
  private betFeedInvalidator: ((userId: string) => Promise<void>) | null = null;

  /**
   * Set cache references for invalidation
   * Called by BetFeedService during initialization
   */
  setInvalidationCaches(
    userCache: TtlMemoryCache<any>,
    betFeedInvalidator: (userId: string) => Promise<void>,
  ): void {
    this.userCache = userCache;
    this.betFeedInvalidator = betFeedInvalidator;
    this.logger.log('Cache references set for invalidation');
  }

  /**
   * Invalidate user's bets from Redis bet-feed caches
   * Called when user privacy changes to remove their bets from public feed
   */
  private async invalidateBetFeedCaches(userId: string): Promise<void> {
    if (this.betFeedInvalidator) {
      try {
        await this.betFeedInvalidator(userId);
      } catch (error) {
        this.logger.error(`Failed to invalidate bet-feed caches for user ${userId}:`, error);
      }
    }
  }
}
