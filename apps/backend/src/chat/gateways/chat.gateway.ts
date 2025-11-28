import { Logger, UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { AdminRole } from '@zetik/shared-entities';
import { Server } from 'socket.io';
import { commonConfig } from '../../config/common.config';
import { UserRoleService } from '../../users/services/user-role.service';
import { WebSocketExceptionFilter } from '../../websocket/filters/websocket-exception.filter';
import { WebSocketAuthGuard } from '../../websocket/guards/websocket-auth.guard';
import { RateLimit } from '../../websocket/interceptors/websocket-rate-limit.interceptor';
import {
  AuthenticatedSocket,
  WebSocketAuthService,
} from '../../websocket/services/websocket-auth.service';
import { ChatRoles } from '../decorators/chat-roles.decorator';
import { DeleteMessageDto, GetMessagesDto, SendMessageDto } from '../dto/chat.dto';
import { ChatRoleGuard } from '../guards/chat-role.guard';
import { IChat, IChatMessage, ITipNotification } from '../interfaces/chat.interfaces';
import { ChatService } from '../services/chat.service';

@WebSocketGateway({
  cors: {
    origin: commonConfig().corsOrigins,
    credentials: true,
  },
  namespace: '/chat',
})
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();

  constructor(
    private readonly authService: WebSocketAuthService,
    private readonly chatService: ChatService,
    private readonly userRoleService: UserRoleService,
  ) {}

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.authService.authenticateConnection(socket);

      socket.emit('connected', {
        message: 'Successfully connected to chat server',
        userId: user.id,
        timestamp: new Date(),
      });

      this.connectedClients.set(user.id, socket);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`WebSocket connection rejected: ${errorMessage}`, {
        socketId: socket.id,
        ip: socket.handshake.address,
        error: errorMessage,
      });

      // Pass through the actual error message from WsException
      const wsError =
        error instanceof Error && error.message ? error.message : 'Authentication failed';

      socket.emit('error', {
        message: wsError,
        code: 'AUTH_FAILED',
        timestamp: new Date(),
      });

      socket.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.userId;

    if (userId) {
      this.connectedClients.delete(userId);
    }
  }

  @SubscribeMessage('getChats')
  @UseGuards(WebSocketAuthGuard)
  async handleGetChats(): Promise<IChat[]> {
    return this.chatService.getChats();
  }

  @SubscribeMessage('getMessages')
  @UseGuards(WebSocketAuthGuard)
  async handleGetMessages(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: GetMessagesDto,
  ): Promise<IChatMessage[]> {
    const user = this.authService.getUser(socket);
    return this.chatService.getMessages(data.chatId, user.id);
  }

  @SubscribeMessage('sendMessage')
  @RateLimit({ rps: 1 })
  @UseGuards(WebSocketAuthGuard)
  async handleSendMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto,
  ): Promise<IChatMessage> {
    const user = this.authService.getUser(socket);

    const message = await this.chatService.sendMessage(data.chatId, data.message, {
      id: user.id,
      name: user.displayName || user.username || 'Anonymous',
      avatar: user.avatarUrl,
    });

    this.broadcastNewMessage(message);

    return message;
  }

  @SubscribeMessage('ping')
  @UseGuards(WebSocketAuthGuard)
  handlePing(@ConnectedSocket() socket: AuthenticatedSocket): void {
    socket.emit('pong', {
      timestamp: new Date(),
      userId: socket.userId,
    });
  }

  @SubscribeMessage('deleteMessage')
  @UseGuards(WebSocketAuthGuard, ChatRoleGuard)
  @ChatRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
  async handleDeleteMessage(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: DeleteMessageDto,
  ): Promise<{ success: boolean; messageId: string }> {
    const user = this.authService.getUser(socket);
    await this.chatService.deleteMessage(data.messageId, user.id);

    this.server.emit('messageDeleted', {
      messageId: data.messageId,
      deletedBy: user.id,
    });

    return { success: true, messageId: data.messageId };
  }

  private broadcastNewMessage(message: IChatMessage): void {
    this.server.emit('newMessage', message);
  }

  /**
   * Get global chat ID for tip notifications.
   *
   * Note: This method queries the database on every call instead of caching
   * to ensure cluster mode compatibility. In production, the backend runs in
   * cluster mode with multiple worker processes, and instance-level caching
   * would cause inconsistent state across workers.
   *
   * Performance impact is minimal since tip events are relatively infrequent.
   * If tips become very frequent, consider implementing Redis-based caching.
   */
  private async getGlobalChatId(): Promise<string | null> {
    const chats = await this.chatService.getChats();
    if (chats.length === 0) {
      this.logger.error('No chats available for tip notification');
      return null;
    }

    const englishChat = chats.find((c) => c.name === 'English');
    if (englishChat) {
      return englishChat.id;
    }

    this.logger.warn(
      `English chat not found, using first available chat "${chats[0].name}" as global chat`,
    );
    return chats[0].id;
  }

  @OnEvent('balance.tip')
  async handleTipEvent(payload: ITipNotification): Promise<void> {
    try {
      const globalChatId = await this.getGlobalChatId();
      if (!globalChatId) {
        return;
      }

      const amountStr = payload.amount.toString();
      const senderRole = await this.userRoleService.getUserRole(payload.sender.id);

      const tipMessage = await this.chatService.sendTipMessage(
        globalChatId,
        {
          id: payload.sender.id,
          name: payload.sender.displayName || payload.sender.username,
          avatar: payload.sender.avatarUrl,
          role: senderRole ?? undefined,
        },
        {
          id: payload.recipient.id,
          name: payload.recipient.displayName || payload.recipient.username,
          avatar: payload.recipient.avatarUrl,
        },
        payload.asset,
        amountStr,
      );

      this.broadcastNewMessage(tipMessage);
    } catch (error) {
      this.logger.error('Failed to create tip message', {
        error: error instanceof Error ? error.message : String(error),
        senderId: payload.sender.id,
        recipientId: payload.recipient.id,
        amount: payload.amount.toString(),
        asset: payload.asset,
      });
    }
  }
}
