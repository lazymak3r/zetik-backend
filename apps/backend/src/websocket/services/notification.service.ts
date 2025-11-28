import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { NotificationGateway } from '../gateways/notification.gateway';

export interface Notification {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  /**
   * Send notification to a specific user
   */
  sendToUser(userId: string, notification: Notification): void {
    try {
      this.notificationGateway.sendNotification(userId, notification);
    } catch (error) {
      this.logger.error(`Failed to send notification to user ${userId}`, {
        userId,
        notificationType: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Save notification to database and send to user
   */
  async sendToUserAndSave(userId: string, notification: Notification): Promise<void> {
    try {
      // Save notification to database
      const notificationEntity = this.notificationRepository.create({
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: false,
        isDeleted: false,
      });

      await this.notificationRepository.save(notificationEntity);

      this.sendToUser(userId, notification);

      this.logger.log(`Notification saved and sent to user ${userId}`, {
        userId,
        notificationType: notification.type,
        notificationId: notificationEntity.id,
      });
    } catch (error) {
      this.logger.error(`Failed to save and send notification to user ${userId}`, {
        userId,
        notificationType: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds: string[], notification: Notification): void {
    for (const userId of userIds) {
      this.sendToUser(userId, notification);
    }
  }

  /**
   * Save notification to database for multiple users and send via WebSocket
   * Optimized for batch operations - single DB insert and batch WebSocket sends
   */
  async sendToUsersAndSave(userIds: string[], notification: Notification): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      const notificationEntities = userIds.map((userId) =>
        this.notificationRepository.create({
          userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          isRead: false,
          isDeleted: false,
        }),
      );

      await this.notificationRepository.insert(notificationEntities);

      this.notificationGateway.sendNotificationToUsers(userIds, notification);

      this.logger.log(`Notification saved and sent to ${userIds.length} users`, {
        userCount: userIds.length,
        notificationType: notification.type,
      });
    } catch (error) {
      this.logger.error(`Failed to save and send notification to ${userIds.length} users`, {
        userCount: userIds.length,
        notificationType: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcast(notification: Notification): void {
    try {
      this.notificationGateway.broadcastNotification(notification);

      this.logger.log(`Notification broadcasted to all users`, {
        notificationType: notification.type,
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast notification`, {
        notificationType: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
