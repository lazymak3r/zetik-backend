import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { commonConfig } from '../../config/common.config';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import { AuthenticatedSocket, WebSocketAuthService } from '../services/websocket-auth.service';

@WebSocketGateway({
  cors: {
    origin: commonConfig().corsOrigins,
    credentials: true,
  },
  namespace: '/notifications',
})
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly authService: WebSocketAuthService) {}

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.authService.authenticateConnection(socket);

      // Join a per-user room so we don't need to track socketIds manually
      const userRoom = this.getUserRoom(user.id);
      await socket.join(userRoom);

      socket.emit('connected', {
        message: 'Successfully connected to notification server',
        userId: user.id,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Notification WebSocket connection rejected: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          socketId: socket.id,
          ip: socket.handshake.address,
        },
      );

      socket.emit('error', {
        message: 'Authentication failed',
        code: 'AUTH_FAILED',
      });

      socket.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_socket: AuthenticatedSocket): void {
    // socket.io automatically leaves rooms on disconnect
  }

  /**
   * Ping/Pong for connection keep-alive
   */
  @SubscribeMessage('ping')
  handlePing(socket: AuthenticatedSocket): void {
    socket.emit('pong', {
      timestamp: new Date(),
      userId: socket.userId,
    });
  }

  /**
   * Send notification to specific user
   */
  sendNotification(userId: string, notification: any): void {
    const userRoom = this.getUserRoom(userId);

    try {
      this.server.to(userRoom).emit('notification', {
        type: 'notification',
        data: notification,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to emit WebSocket notification for user ${userId}`, {
        userId,
        notificationType: notification.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send notification to multiple users
   * Uses Socket.IO's ability to broadcast to multiple rooms at once
   */
  sendNotificationToUsers(userIds: string[], notification: any): void {
    if (userIds.length === 0) {
      return;
    }

    const userRooms = userIds.map((userId) => this.getUserRoom(userId));

    const payload = {
      type: 'notification',
      data: notification,
      timestamp: new Date(),
    };

    this.server.to(userRooms).emit('notification', payload);
  }

  /**
   * Broadcast notification to all connected users
   */
  broadcastNotification(notification: any): void {
    this.server.emit('notification', {
      type: 'notification',
      data: notification,
      timestamp: new Date(),
    });
  }

  private getUserRoom(userId: string): string {
    return `user:${userId}`;
  }
}
