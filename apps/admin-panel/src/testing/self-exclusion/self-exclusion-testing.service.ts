import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelfExclusionEntity, SelfExclusionTypeEnum } from '@zetik/shared-entities';
import { In, IsNull, Not, Repository } from 'typeorm';

/**
 * Testing service for self-exclusion functionality
 * Provides methods to manipulate timestamps for testing without waiting 24 hours
 *
 * IMPORTANT: This service should only be used in development/staging environments
 */
@Injectable()
export class SelfExclusionTestingService {
  private readonly logger = new Logger(SelfExclusionTestingService.name);

  constructor(
    @InjectRepository(SelfExclusionEntity)
    private readonly selfExclusionRepository: Repository<SelfExclusionEntity>,
  ) {}

  /**
   * Get all self-exclusions for a user
   */
  async getUserSelfExclusions(userId: string): Promise<SelfExclusionEntity[]> {
    return this.selfExclusionRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get user's gambling limits with usage information
   */
  async getUserGamblingLimits(userId: string): Promise<{
    depositLimits: SelfExclusionEntity[];
    lossLimits: SelfExclusionEntity[];
    wagerLimits: SelfExclusionEntity[];
  }> {
    const depositLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.DEPOSIT_LIMIT,
        isActive: true,
      },
    });

    const lossLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.LOSS_LIMIT,
        isActive: true,
      },
    });

    const wagerLimits = await this.selfExclusionRepository.find({
      where: {
        userId,
        type: SelfExclusionTypeEnum.WAGER_LIMIT,
        isActive: true,
      },
    });

    return {
      depositLimits,
      lossLimits,
      wagerLimits,
    };
  }

  /**
   * Expire a cooldown and start the post-cooldown window (for testing)
   * Sets endDate to 1 hour ago and postCooldownWindowEnd to 24 hours from now
   */
  async testExpireCooldown(id: string): Promise<SelfExclusionEntity> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id, type: SelfExclusionTypeEnum.COOLDOWN },
    });

    if (!exclusion) {
      throw new NotFoundException('Cooldown not found');
    }

    // Set endDate to 1 hour ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    exclusion.endDate = pastDate;

    // Set postCooldownWindowEnd to 24 hours from now
    const windowEnd = new Date();
    windowEnd.setHours(windowEnd.getHours() + 24);
    exclusion.postCooldownWindowEnd = windowEnd;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Expired cooldown ${id} and started post-cooldown window`);

    return exclusion;
  }

  /**
   * Expire the post-cooldown window (for testing)
   * Sets postCooldownWindowEnd to 1 hour ago to trigger silent revert on next cron
   */
  async testExpireWindow(id: string): Promise<SelfExclusionEntity> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id },
    });

    if (!exclusion) {
      throw new NotFoundException('Self-exclusion not found');
    }

    // Set postCooldownWindowEnd to 1 hour ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    exclusion.postCooldownWindowEnd = pastDate;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Expired post-cooldown window for ${id}`);

    return exclusion;
  }

  /**
   * Expire the removal countdown (for testing)
   * Sets removalRequestedAt to 25 hours ago to trigger deletion on next cron
   */
  async testExpireRemoval(id: string): Promise<SelfExclusionEntity> {
    const exclusion = await this.selfExclusionRepository.findOne({
      where: { id },
    });

    if (!exclusion) {
      throw new NotFoundException('Self-exclusion not found');
    }

    // Set removalRequestedAt to 25 hours ago
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 25);
    exclusion.removalRequestedAt = pastDate;

    await this.selfExclusionRepository.save(exclusion);

    this.logger.log(`TEST: Set removal countdown to expired for ${id}`);

    return exclusion;
  }

  /**
   * Manually trigger expiration of outdated self-exclusions
   * This directly processes all expiration logic without waiting for the cron job
   */
  async triggerExpirationCron(): Promise<{
    expiredCooldowns: number;
    expiredWindows: number;
    expiredTemporary: number;
    removedLimits: number;
  }> {
    const now = new Date();
    let expiredCooldowns = 0;
    let expiredWindows = 0;
    let expiredTemporary = 0;
    let removedLimits = 0;

    try {
      // 1. Find expired cooldowns that need to enter post-cooldown window
      const cooldownsToExpire = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.COOLDOWN,
          isActive: true,
          endDate: Not(IsNull()),
          postCooldownWindowEnd: IsNull(),
        },
      });

      for (const cooldown of cooldownsToExpire) {
        if (cooldown.endDate && cooldown.endDate < now) {
          // Set post-cooldown window to expire in 24 hours
          const windowEnd = new Date();
          windowEnd.setHours(windowEnd.getHours() + 24);

          cooldown.postCooldownWindowEnd = windowEnd;
          await this.selfExclusionRepository.save(cooldown);
          expiredCooldowns++;

          this.logger.log(
            `Cooldown ${cooldown.id} for user ${cooldown.userId} entered post-cooldown window until ${windowEnd.toISOString()}`,
          );
        }
      }

      // 2. Find cooldowns with expired post-cooldown windows (silent revert to normal)
      const windowsToExpire = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.COOLDOWN,
          isActive: true,
          postCooldownWindowEnd: Not(IsNull()),
        },
      });

      for (const cooldown of windowsToExpire) {
        if (cooldown.postCooldownWindowEnd && cooldown.postCooldownWindowEnd < now) {
          await this.selfExclusionRepository.remove(cooldown);
          expiredWindows++;
          this.logger.log(
            `Deleted cooldown ${cooldown.id} for user ${cooldown.userId} - silent revert to normal`,
          );
        }
      }

      // 3. Find expired temporary exclusions and deactivate them
      const temporaryToExpire = await this.selfExclusionRepository.find({
        where: {
          type: SelfExclusionTypeEnum.TEMPORARY,
          isActive: true,
          endDate: Not(IsNull()),
        },
      });

      for (const exclusion of temporaryToExpire) {
        if (exclusion.endDate && exclusion.endDate < now) {
          exclusion.isActive = false;
          await this.selfExclusionRepository.save(exclusion);
          expiredTemporary++;
          this.logger.log(
            `Deactivated expired temporary self-exclusion for user ${exclusion.userId} (ID: ${exclusion.id})`,
          );
        }
      }

      // 4. Delete limits with expired removal countdown (24h passed since removal request)
      const limitsToRemove = await this.selfExclusionRepository.find({
        where: {
          type: In([
            SelfExclusionTypeEnum.DEPOSIT_LIMIT,
            SelfExclusionTypeEnum.LOSS_LIMIT,
            SelfExclusionTypeEnum.WAGER_LIMIT,
          ]),
          removalRequestedAt: Not(IsNull()),
        },
      });

      for (const limit of limitsToRemove) {
        if (!limit.removalRequestedAt) continue;

        // Calculate when the 24-hour countdown expires
        const removalTime = new Date(limit.removalRequestedAt);
        removalTime.setHours(removalTime.getHours() + 24);

        // If 24 hours have passed, delete the limit
        if (removalTime <= now) {
          await this.selfExclusionRepository.remove(limit);
          removedLimits++;
          this.logger.log(
            `Removed ${limit.type} limit ${limit.id} for user ${limit.userId} after 24h countdown`,
          );
        }
      }

      this.logger.log(
        `TEST: Expiration cron completed - Cooldowns: ${expiredCooldowns}, Windows: ${expiredWindows}, Temporary: ${expiredTemporary}, Removed Limits: ${removedLimits}`,
      );

      return {
        expiredCooldowns,
        expiredWindows,
        expiredTemporary,
        removedLimits,
      };
    } catch (error) {
      this.logger.error(
        'Error running expiration cron',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
