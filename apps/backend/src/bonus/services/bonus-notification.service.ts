import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BonusNotificationEntity,
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { NotificationService } from '../../websocket/services/notification.service';

export interface IBonusNotificationData {
  bonusId: string;
  bonusType: string;
  amount: string;
  description?: string;
  expiresAt?: Date;
}

@Injectable()
export class BonusNotificationService {
  private readonly logger = new Logger(BonusNotificationService.name);

  constructor(
    @InjectRepository(BonusNotificationEntity)
    private readonly notificationRepo: Repository<BonusNotificationEntity>,
    private readonly notificationService: NotificationService,
  ) {}

  async createBonusNotification(bonusTransaction: BonusTransactionEntity): Promise<void> {
    try {
      if (bonusTransaction.status !== BonusTransactionStatusEnum.PENDING) {
        return;
      }

      const amountInDollars = (parseFloat(bonusTransaction.amount) / 100).toFixed(2);
      const bonusTypeDisplay = this.getBonusTypeDisplayName(bonusTransaction.bonusType);

      const notification = this.notificationRepo.create({
        userId: bonusTransaction.userId,
        bonusTransactionId: bonusTransaction.id,
        type: 'bonus_awarded',
        title: 'New Bonus Available!',
        message: `You have received a ${bonusTypeDisplay} of $${amountInDollars}`,
        data: {
          bonusId: bonusTransaction.id,
          bonusType: bonusTransaction.bonusType,
          amount: amountInDollars,
          description: bonusTransaction.description,
          expiredAt: bonusTransaction.expiredAt,
        },
      });

      await this.notificationRepo.save(notification);

      // Fire-and-forget notification
      void this.notificationService.sendToUserAndSave(bonusTransaction.userId, {
        type: 'bonus_awarded',
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });

      this.logger.log(
        `Bonus awarded notification created for user ${bonusTransaction.userId}, bonus ${bonusTransaction.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create bonus awarded notification for bonus ${bonusTransaction.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async createBonusClaimedNotification(bonusTransaction: BonusTransactionEntity): Promise<void> {
    try {
      if (bonusTransaction.status !== BonusTransactionStatusEnum.CLAIMED) {
        return;
      }

      const amountInDollars = (parseFloat(bonusTransaction.amount) / 100).toFixed(2);
      const bonusTypeDisplay = this.getBonusTypeDisplayName(bonusTransaction.bonusType);

      const notification = this.notificationRepo.create({
        userId: bonusTransaction.userId,
        bonusTransactionId: bonusTransaction.id,
        type: 'bonus_claimed',
        title: 'Bonus Claimed Successfully!',
        message: `You have successfully claimed a ${bonusTypeDisplay} of $${amountInDollars}`,
        data: {
          bonusId: bonusTransaction.id,
          bonusType: bonusTransaction.bonusType,
          amount: amountInDollars,
          description: bonusTransaction.description,
          claimedAt: bonusTransaction.claimedAt,
        },
      });

      await this.notificationRepo.save(notification);

      // Fire-and-forget notification
      void this.notificationService.sendToUserAndSave(bonusTransaction.userId, {
        type: 'bonus_claimed',
        title: notification.title,
        message: notification.message,
        data: notification.data,
      });

      this.logger.log(
        `Bonus claimed notification created for user ${bonusTransaction.userId}, bonus ${bonusTransaction.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create bonus claimed notification for bonus ${bonusTransaction.id}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private getBonusTypeDisplayName(bonusType: string): string {
    switch (bonusType) {
      case 'WEEKLY_AWARD':
        return 'Weekly Bonus';
      case 'MONTHLY_AWARD':
        return 'Monthly Bonus';
      case 'LEVEL_UP':
        return 'Level Up Bonus';
      case 'RANK_UP':
        return 'Rank Up Bonus';
      case 'RAKEBACK':
        return 'Rakeback Bonus';
      case 'WEEKLY_RACE_PRIZE':
        return 'Weekly Race Prize';
      case 'WEEKLY_RELOAD':
        return 'Weekly Reload Bonus';
      default:
        return bonusType
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

  async getUnviewedNotifications(userId: string): Promise<BonusNotificationEntity[]> {
    return this.notificationRepo.find({
      where: { userId, isViewed: false },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async getLastNotifications(userId: string): Promise<BonusNotificationEntity[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 10,
    });
  }

  async markNotificationsAsViewed(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, isViewed: false },
      {
        isViewed: true,
        viewedAt: new Date(),
      },
    );

    this.logger.log(`Marked bonus notifications as viewed for user ${userId}`);
  }

  async getUnviewedCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isViewed: false },
    });
  }
}
