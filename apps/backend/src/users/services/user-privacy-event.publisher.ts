import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';

/**
 * UserPrivacyEventPublisher
 *
 * Single Responsibility: Publish user privacy change events to Redis pub/sub
 *
 * Decouples user service from Redis publishing logic, making it:
 * - Testable (easy to mock)
 * - Reusable (any service can use it)
 * - Maintainable (changes to event format only affect this class)
 *
 * Used by: UserService when user privacy status changes
 * Consumed by: bet-feed-service for cache invalidation
 */
@Injectable()
export class UserPrivacyEventPublisher {
  private readonly logger = new Logger(UserPrivacyEventPublisher.name);
  private readonly CHANNEL = 'user.privacy-changed';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Publish privacy change event to Redis pub/sub
   * Called when user updates their isPrivate setting
   *
   * Event payload:
   * {
   *   userId: string - User ID whose privacy changed
   *   isPrivate: boolean - New privacy status
   *   changedAt: ISO timestamp - When the change occurred
   * }
   */
  async publishPrivacyChanged(userId: string, isPrivate: boolean): Promise<void> {
    try {
      const redis = this.redisService.getClient();
      const payload = {
        userId,
        isPrivate,
        changedAt: new Date().toISOString(),
      };

      await redis.publish(this.CHANNEL, JSON.stringify(payload));

      this.logger.log(`Published user privacy change: userId=${userId}, isPrivate=${isPrivate}`);
    } catch (error) {
      this.logger.error(`Failed to publish user privacy change event:`, error);
      // Don't throw - don't fail user operation if Redis pub/sub fails
      // bet-feed-service will eventually expire cache on its own
    }
  }
}
