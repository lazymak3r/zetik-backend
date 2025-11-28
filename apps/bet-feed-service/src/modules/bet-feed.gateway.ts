import { Logger, OnModuleInit, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BetFeedService, IBetFeedDelta } from './bet-feed.service';

/**
 * Authenticated socket with user information
 */
export interface AuthenticatedSocket extends Socket {
  user?: { id: string };
  userId?: string;
}

/**
 * WebSocket exception filter
 */
@UseFilters()
class WebSocketExceptionFilter {
  catch(exception: WsException, host: any): void {
    const client = host.switchToWs().getClient();
    const data = exception.getError();
    const message = typeof data === 'string' ? data : (data as any)?.message || 'Internal error';
    client.emit('error', { message });
  }
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/bet-feed',
})
@UseFilters(new WebSocketExceptionFilter())
export class BetFeedGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(BetFeedGateway.name);
  private readonly connectedClients = new Map<string, string>(); // socketId -> userId

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly betFeedService: BetFeedService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit(): void {
    this.logger.log('🎯 BetFeedGateway initialized');

    // Subscribe to public bet feed delta updates
    this.eventEmitter.on('bet-feed.delta', (deltaData: IBetFeedDelta) => {
      this.logger.log(
        `📢 [Manual subscription] Received delta event: ${deltaData.tab} - ${deltaData.count} bets`,
      );
      void this.broadcastBetFeedDelta(deltaData);
    });

    // Subscribe to user-specific bet updates (my-bets)
    this.eventEmitter.on('bet-feed.user-bet', (data: { userId: string; bet: any }) => {
      this.logger.log(
        `📢 [Manual subscription] Received user bet: userId ${data.userId} - bet ${data.bet.id}`,
      );
      this.broadcastUserBet(data.userId, data.bet);
    });

    this.logger.log('✅ Manual event subscriptions registered (delta + user bets)');
  }

  /**
   * Handle new WebSocket connection
   * Authentication is optional:
   * - Public bet feed accessible without auth
   * - "My Bets" requires authentication
   */
  handleConnection(socket: AuthenticatedSocket): void {
    // Try to authenticate (optional)
    try {
      const token = this.extractTokenFromSocket(socket);

      if (token) {
        const jwtSecret = this.configService.get<string>('JWT_SECRET');
        if (jwtSecret) {
          const payload = this.jwtService.verify<{ sub: string; userId?: string }>(token, {
            secret: jwtSecret,
          });

          const userId = payload.sub || payload.userId;
          if (userId) {
            socket.userId = userId;
            socket.user = { id: userId };
            this.connectedClients.set(socket.id, userId);

            this.logger.log(`🔗 Bet feed WebSocket connected: User ${userId} (authenticated)`, {
              userId,
              socketId: socket.id,
              ip: socket.handshake.address,
            });

            // Auto-join the public bet-feed room
            void socket.join('bet-feed');

            socket.emit('connected', {
              message: 'Successfully connected to bet feed',
              userId,
              authenticated: true,
              timestamp: new Date(),
            });
            return;
          }
        }
      }
    } catch {
      // Authentication failed - continue as anonymous
    }

    // Anonymous connection
    this.connectedClients.set(socket.id, 'anonymous');

    // Auto-join the public bet-feed room
    void socket.join('bet-feed');

    this.logger.log(`🔗 Bet feed WebSocket connected: ${socket.id} (anonymous)`, {
      socketId: socket.id,
      ip: socket.handshake.address,
    });

    socket.emit('connected', {
      message: 'Successfully connected to bet feed',
      authenticated: false,
      timestamp: new Date(),
    });
  }

  /**
   * Extract JWT token from WebSocket connection
   */
  private extractTokenFromSocket(socket: Socket): string | null {
    // Try authorization header
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const tokenQuery = socket.handshake.query.token;
    if (typeof tokenQuery === 'string') {
      return tokenQuery;
    }

    // Try cookies
    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
      const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
      if (accessTokenMatch) {
        return accessTokenMatch[1];
      }
    }

    // Try auth object in handshake
    const authToken = (socket.handshake.auth as { token?: string })?.token;
    if (typeof authToken === 'string') {
      return authToken;
    }

    return null;
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    this.connectedClients.delete(socket.id);

    if (userId) {
      this.logger.log(`🔌 Bet feed WebSocket disconnected: User ${userId}`, {
        userId,
        socketId: socket.id,
      });
    } else {
      this.logger.log(`🔌 Bet feed WebSocket disconnected: ${socket.id}`, {
        socketId: socket.id,
      });
    }

    // Update subscriber count in service
    void this.updateSubscriberCount();
  }

  /**
   * Subscribe to "My Bets" - requires authentication
   * Joins user to their personal bet room: 'my-bets:{userId}'
   */
  @SubscribeMessage('subscribe-my-bets')
  handleSubscribeMyBets(@ConnectedSocket() socket: AuthenticatedSocket): void {
    try {
      if (!socket.userId) {
        throw new WsException('Authentication required for My Bets');
      }

      const roomName = `my-bets:${socket.userId}`;
      void socket.join(roomName);

      socket.emit('subscribed', {
        message: 'Subscribed to My Bets',
        room: 'my-bets',
        timestamp: new Date(),
      });

      this.logger.log(`📡 User ${socket.userId} subscribed to My Bets`);
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to subscribe to My Bets',
        code: 'SUBSCRIBE_MY_BETS_FAILED',
      });
    }
  }

  /**
   * Unsubscribe from "My Bets"
   */
  @SubscribeMessage('unsubscribe-my-bets')
  handleUnsubscribeMyBets(@ConnectedSocket() socket: AuthenticatedSocket): void {
    try {
      if (!socket.userId) {
        this.logger.debug(`⚠️ Client ${socket.id} not authenticated, ignoring unsubscribe`);
        return;
      }

      const roomName = `my-bets:${socket.userId}`;
      void socket.leave(roomName);

      socket.emit('unsubscribed', {
        message: 'Unsubscribed from My Bets',
        room: 'my-bets',
        timestamp: new Date(),
      });

      this.logger.log(`🚪 User ${socket.userId} unsubscribed from My Bets`);
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to unsubscribe from My Bets',
        code: 'UNSUBSCRIBE_MY_BETS_FAILED',
      });
    }
  }

  /**
   * Ping/Pong for connection keep-alive
   */
  @SubscribeMessage('ping')
  handlePing(socket: Socket): void {
    socket.emit('pong', {
      timestamp: new Date(),
    });
  }

  /**
   * NOTE: Event handlers removed - using manual subscription in onModuleInit instead
   * The @OnEvent decorators were causing duplicate broadcasts when combined with manual subscription
   * Only manual subscription via EventEmitter2.on() is used now (see onModuleInit)
   */

  /**
   * Broadcast delta update (only new bets) to all subscribed clients
   * Broadcasts to single 'bet-feed' room with tab info in payload
   * Frontend filters updates by active tab
   */
  private async broadcastBetFeedDelta(deltaData: IBetFeedDelta): Promise<void> {
    this.logger.log(
      `🔊 Broadcasting delta to bet-feed room: ${deltaData.tab} - ${deltaData.count} new bets`,
    );

    // Filter private users on output (Redis stores full data, mask only on output)
    const filteredBets = await this.betFeedService.filterPrivateUsers(deltaData.newBets);

    // Broadcast to single 'bet-feed' room with tab info
    this.server.to('bet-feed').emit('bet-feed-delta', {
      type: 'delta',
      data: {
        tab: deltaData.tab,
        newBets: filteredBets,
        count: filteredBets.length,
        timestamp: deltaData.timestamp,
      },
    });

    this.logger.log(
      `✅ Broadcasted ${deltaData.tab} delta update: ${filteredBets.length} new bets`,
    );
  }

  /**
   * Broadcast user-specific bet to "my-bets:{userId}" room
   * Only users subscribed to "My Bets" will receive their own bet updates
   */
  private broadcastUserBet(userId: string, bet: any): void {
    const roomName = `my-bets:${userId}`;

    this.logger.log(`🔊 Broadcasting user bet to ${roomName}: bet ${bet.id}`);

    // Broadcast to user-specific room
    this.server.to(roomName).emit('bet-feed-delta', {
      type: 'delta',
      data: {
        tab: 'my-bets', // Special tab identifier for "My Bets"
        newBets: [bet],
        count: 1,
        timestamp: new Date().toISOString(),
      },
    });

    this.logger.log(`✅ Broadcasted user bet to ${roomName}`);
  }

  /**
   * Update subscriber count in service
   */
  private async updateSubscriberCount(): Promise<void> {
    const count = await this.getSubscribedClientsCount();
    this.betFeedService.setSubscribersCount(count);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get subscribed clients count (all in single 'bet-feed' room)
   */
  async getSubscribedClientsCount(): Promise<number> {
    const sockets = await this.server.to('bet-feed').allSockets();
    return sockets.size;
  }
}
