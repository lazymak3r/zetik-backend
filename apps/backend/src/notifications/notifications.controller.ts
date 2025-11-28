import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Request,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';
import { PaginatedNotificationsResponseDto } from './dto/paginated-notifications-response.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: false,
    forbidNonWhitelisted: false,
  }),
)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Get paginated list of notifications for the authenticated user (excluding deleted ones)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated notifications with metadata',
    type: PaginatedNotificationsResponseDto,
  })
  async getUserNotifications(
    @Request() req: any,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = query;

    return this.notificationsService.getUserNotifications(userId, page, limit);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a specific notification as read for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markNotificationAsRead(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    const userId = req.user.id;
    return this.notificationsService.markAsRead(userId, notificationId);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all notifications as read for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  async markAllNotificationsAsRead(@Request() req: any): Promise<void> {
    const userId = req.user.id;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Mark notification as deleted',
    description: 'Mark a specific notification as deleted for the authenticated user',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async markNotificationAsDeleted(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) notificationId: string,
  ): Promise<void> {
    const userId = req.user.id;
    return this.notificationsService.markAsDeleted(userId, notificationId);
  }

  @Delete()
  @ApiOperation({
    summary: 'Mark all notifications as deleted',
    description: 'Mark all notifications as deleted for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as deleted successfully',
  })
  async markAllNotificationsAsDeleted(@Request() req: any): Promise<void> {
    const userId = req.user.id;
    return this.notificationsService.markAllAsDeleted(userId);
  }
}
