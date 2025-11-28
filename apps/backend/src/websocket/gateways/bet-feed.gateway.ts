import { UseFilters } from '@nestjs/common';
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
import { WebSocketExceptionFilter } from '../../websocket/filters/websocket-exception.filter';
import {
  AuthenticatedSocket,
  WebSocketAuthService,
} from '../../websocket/services/websocket-auth.service';

/**
 * Bet Feed Gateway (Main Backend Relay)
 *
 * This gateway runs in the main backend (port 4000) and acts as a relay
 * for bet feed broadcasts from the bet-feed-service (port 4004).
 *
 * Architecture:
 * - bet-feed-service: Processes events, updates cache, broadcasts deltas
 * - Redis adapter: Syncs broadcasts from port 4004 → port 4000
 * - This gateway: Relays broadcasts to connected frontend clients
 *
 * Public Access (General Bet Feed):
 * - No authentication required for public bet feed
 * - Single room 'bet-feed' for all public updates (all bets, lucky wins, zetiks)
 * - Frontend receives all delta updates and filters by active tab in UI
 *
 * Authenticated Access (My Bets):
 * - Authentication required for "My Bets" tab
 * - User-specific room 'my-bets:{userId}' for personal bet updates
 * - Only authenticated users can subscribe to their own bets
 *
 * The heavy lifting (event processing, cache updates) happens in bet-feed-service.
 * This gateway is minimal - it only handles client connections and subscriptions.
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/bet-feed',
  pingTimeout: 60000, // 60 seconds - disconnect if no pong received
  pingInterval: 20000, // Send ping every 20 seconds
})
@UseFilters(new WebSocketExceptionFilter())
export class BetFeedGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly authService: WebSocketAuthService) {}

  /**
   * Handle client connection
   * Authentication is optional:
   * - Public bet feed accessible without auth
   * - "My Bets" requires authentication
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.authService.authenticateConnection(socket);

      socket.emit('connected', {
        message: 'Connected to bet feed',
        userId: user.id,
        authenticated: true,
        timestamp: new Date(),
      });
    } catch {
      socket.emit('connected', {
        message: 'Connected to bet feed',
        authenticated: false,
        timestamp: new Date(),
      });
    }

    await socket.join('bet-feed');
  }

  /**
   * Handle client disconnection
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_socket: AuthenticatedSocket): void {
    // Silent disconnect
  }

  /**
   * Subscribe to "My Bets" - requires authentication
   * Joins user to their personal bet room: 'my-bets:{userId}'
   */
  @SubscribeMessage('subscribe-my-bets')
  async handleSubscribeMyBets(@ConnectedSocket() socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Authentication required for My Bets');
      }

      const roomName = `my-bets:${socket.userId}`;
      await socket.join(roomName);

      socket.emit('subscribed', {
        message: 'Subscribed to My Bets',
        room: 'my-bets',
        timestamp: new Date(),
      });
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
  async handleUnsubscribeMyBets(@ConnectedSocket() socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!socket.userId) {
        return;
      }

      const roomName = `my-bets:${socket.userId}`;
      await socket.leave(roomName);

      socket.emit('unsubscribed', {
        message: 'Unsubscribed from My Bets',
        room: 'my-bets',
        timestamp: new Date(),
      });
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Failed to unsubscribe from My Bets',
        code: 'UNSUBSCRIBE_MY_BETS_FAILED',
      });
    }
  }

  /**
   * Ping/pong for connection keep-alive
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket): void {
    socket.emit('pong', {
      timestamp: new Date(),
    });
  }
}
