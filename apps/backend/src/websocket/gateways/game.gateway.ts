import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { commonConfig } from '../../config/common.config';
import { JoinRoomDto } from '../dto/join-room.dto';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import { GameRoomService } from '../services/game-room.service';
import { AuthenticatedSocket, WebSocketAuthService } from '../services/websocket-auth.service';

@WebSocketGateway({
  cors: {
    origin: commonConfig().corsOrigins,
    credentials: true,
  },
  namespace: '/games',
})
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly authService: WebSocketAuthService,
    private readonly gameRoomService: GameRoomService,
  ) {}

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.authService.authenticateConnection(socket);

      socket.emit('connected', {
        message: 'Successfully connected to game server',
        userId: user.id,
        timestamp: new Date(),
      });

      this.logger.log(`WebSocket connected: User ${user.id}`, {
        userId: user.id,
        socketId: socket.id,
        ip: socket.handshake.address,
      });
    } catch (error) {
      this.logger.warn(
        `WebSocket connection rejected: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.userId;

    if (userId) {
      this.gameRoomService.handleDisconnect(socket);

      this.logger.log(`WebSocket disconnected: User ${userId}`, {
        userId,
        socketId: socket.id,
      });
    }
  }

  /**
   * Join a game room
   */
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: JoinRoomDto,
  ): void {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const room = this.gameRoomService.joinRoom(socket, data.gameType);

      // Send room info to the joining player
      socket.emit('room_joined', {
        type: 'room_joined',
        data: {
          roomId: room.id,
          gameType: room.gameType,
          playersCount: room.players.size,
          maxPlayers: room.maxPlayers,
          state: room.state,
          players: Array.from(room.players.values()).map((player) => ({
            userId: player.userId,
            username: player.username,
            isActive: player.isActive,
          })),
        },
        timestamp: new Date(),
      });

      this.logger.log(`User ${socket.userId} joined ${data.gameType} room ${room.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to join room: ${errorMessage}`, {
        userId: socket.userId,
        gameType: data.gameType,
        error: errorMessage,
      });

      socket.emit('error', {
        message: errorMessage,
        code: 'JOIN_ROOM_FAILED',
      });
    }
  }

  /**
   * Leave current room
   */
  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() socket: AuthenticatedSocket): void {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      this.gameRoomService.leaveRoom(socket);

      socket.emit('room_left', {
        type: 'room_left',
        data: { success: true },
        timestamp: new Date(),
      });

      this.logger.log(`User ${socket.userId} left room`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to leave room: ${errorMessage}`, {
        userId: socket.userId,
        error: errorMessage,
      });

      socket.emit('error', {
        message: errorMessage,
        code: 'LEAVE_ROOM_FAILED',
      });
    }
  }

  /**
   * Get current room info
   */
  @SubscribeMessage('get_room_info')
  handleGetRoomInfo(@ConnectedSocket() socket: AuthenticatedSocket): void {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const room = this.gameRoomService.getRoomByUserId(socket.userId!);

      if (!room) {
        socket.emit('room_info', {
          type: 'room_info',
          data: null,
          timestamp: new Date(),
        });
        return;
      }

      socket.emit('room_info', {
        type: 'room_info',
        data: {
          roomId: room.id,
          gameType: room.gameType,
          playersCount: room.players.size,
          maxPlayers: room.maxPlayers,
          state: room.state,
          gameData: room.gameData as Record<string, unknown>,
          players: Array.from(room.players.values()).map((player) => ({
            userId: player.userId,
            username: player.username,
            isActive: player.isActive,
          })),
        },
        timestamp: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      socket.emit('error', {
        message: errorMessage,
        code: 'GET_ROOM_INFO_FAILED',
      });
    }
  }

  /**
   * Ping/Pong for connection keep-alive
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: AuthenticatedSocket): void {
    socket.emit('pong', {
      timestamp: new Date(),
      userId: socket.userId,
    });
  }

  /**
   * Broadcast game update to room
   */
  broadcastGameUpdate(
    roomId: string,
    event:
      | 'game_start'
      | 'game_update'
      | 'game_end'
      | 'player_action'
      | 'player_join'
      | 'player_leave',
    data: unknown,
  ): void {
    this.gameRoomService.broadcastToRoom(
      roomId,
      event,
      {
        type: event,
        data,
        timestamp: new Date(),
      },
      this.server,
    );
  }

  /**
   * Send game update to specific player
   */
  sendToPlayer(
    userId: string,
    event:
      | 'game_start'
      | 'game_update'
      | 'game_end'
      | 'player_action'
      | 'player_join'
      | 'player_leave',
    data: unknown,
  ): void {
    this.gameRoomService.sendToPlayer(
      userId,
      event,
      {
        type: event,
        data,
        timestamp: new Date(),
      },
      this.server,
    );
  }
}
