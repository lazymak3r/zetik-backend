import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
  ) {}

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    notifications: NotificationEntity[];
    total: number;
    page: number;
    totalPages: number;
    unreadCount: number;
  }> {
    const skip = (page - 1) * limit;

    // Get notifications (excluding deleted ones)
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: {
        userId,
        isDeleted: false,
      },
      order: {
        createdAt: 'DESC',
      },
      skip,
      take: limit,
    });

    // Get unread count
    const unreadCount = await this.notificationRepository.count({
      where: {
        userId,
        isRead: false,
        isDeleted: false,
      },
    });

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        userId,
        isDeleted: false,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.isRead) {
      await this.notificationRepository.update(notificationId, {
        isRead: true,
        readAt: new Date(),
      });

      this.logger.log(`Notification marked as read`, {
        userId,
        notificationId,
      });
    }
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        userId,
        isRead: false,
        isDeleted: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    this.logger.log(`All notifications marked as read for user`, {
      userId,
    });
  }

  async markAsDeleted(userId: string, notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.notificationRepository.update(notificationId, {
      isDeleted: true,
      deletedAt: new Date(),
    });

    this.logger.log(`Notification marked as deleted`, {
      userId,
      notificationId,
    });
  }

  async markAllAsDeleted(userId: string): Promise<void> {
    await this.notificationRepository.update(
      {
        userId,
        isDeleted: false,
      },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    this.logger.log(`All notifications marked as deleted for user`, {
      userId,
    });
  }
}
