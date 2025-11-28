import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  BonusNotificationCountDto,
  BonusNotificationsResponseDto,
} from '../dto/bonus-notification.dto';
import { BonusNotificationService } from '../services/bonus-notification.service';

@ApiTags('Bonus Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bonus/notifications')
export class BonusNotificationsController {
  constructor(private readonly bonusNotificationService: BonusNotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get last 10 bonus notifications for current user' })
  @ApiResponse({
    status: 200,
    type: BonusNotificationsResponseDto,
    description: 'List of bonus notifications',
  })
  async getNotifications(
    @Req() req: Request & { user: { id: string } },
  ): Promise<BonusNotificationsResponseDto> {
    const userId = req.user.id;

    const [notifications, unviewedCount] = await Promise.all([
      this.bonusNotificationService.getLastNotifications(userId),
      this.bonusNotificationService.getUnviewedCount(userId),
    ]);

    return {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        userId: notification.userId,
        bonusTransactionId: notification.bonusTransactionId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data as any,
        isViewed: notification.isViewed,
        createdAt: notification.createdAt,
        viewedAt: notification.viewedAt,
      })),
      unviewedCount,
    };
  }

  @Get('unviewed-count')
  @ApiOperation({ summary: 'Get count of unviewed bonus notifications' })
  @ApiResponse({
    status: 200,
    type: BonusNotificationCountDto,
    description: 'Number of unviewed notifications',
  })
  async getUnviewedCount(
    @Req() req: Request & { user: { id: string } },
  ): Promise<BonusNotificationCountDto> {
    const userId = req.user.id;
    const count = await this.bonusNotificationService.getUnviewedCount(userId);
    return { count };
  }

  @Post('mark-viewed')
  @ApiOperation({ summary: 'Mark all bonus notifications as viewed' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as viewed',
  })
  async markAsViewed(
    @Req() req: Request & { user: { id: string } },
  ): Promise<{ success: boolean }> {
    const userId = req.user.id;
    await this.bonusNotificationService.markNotificationsAsViewed(userId);
    return { success: true };
  }
}
