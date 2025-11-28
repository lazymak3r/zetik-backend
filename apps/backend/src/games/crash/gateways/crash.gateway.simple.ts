import { Inject, Logger, UseFilters, UsePipes, ValidationPipe, forwardRef } from '@nestjs/common';
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
import {
  CashOutWebSocketDto,
  JoinCrashRoomDto,
  PlaceCrashBetWebSocketDto,
} from '../../../websocket/dto/crash-events.dto';
import { WebSocketExceptionFilter } from '../../../websocket/filters/websocket-exception.filter';
import {
  AuthenticatedSocket,
  WebSocketAuthService,
} from '../../../websocket/services/websocket-auth.service';
import { CrashService } from '../crash.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: '/crash',
})
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class CrashGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(CrashGateway.name);

  constructor(
    private readonly authService: WebSocketAuthService,
    @Inject(forwardRef(() => CrashService))
    private readonly crashService: CrashService,
  ) {}

  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      const user = await this.authService.authenticateConnection(socket);

      // Check for interrupted sessions and send recovery data
      const interruptedSessions = await this.crashService.getInterruptedSessions(user.id);

      socket.emit('connected', {
        message: 'Connected to crash room',
        userId: user.id,
        interruptedSessions: interruptedSessions.length > 0 ? interruptedSessions : undefined,
      });

      this.logger.log(`Player ${user.id} connected to crash room`, {
        interruptedSessions: interruptedSessions.length,
      });
    } catch {
      socket.emit('error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.userId) {
      this.logger.log(`Player ${socket.userId} disconnected from crash room`);
    }
  }

  @SubscribeMessage('crash:get_state')
  async handleGetState(@ConnectedSocket() socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      this.logger.log(`User ${socket.user?.id} requested game state via crash:get_state`);

      const currentGame = await this.crashService.getCurrentGame();

      socket.emit('crash:game_state', {
        type: 'crash:game_state',
        data: currentGame,
        timestamp: new Date(),
      });

      this.logger.log(`Sent game state to user ${socket.user?.id}: ${currentGame?.status}`);
    } catch (error) {
      this.logger.error(`Failed to get state for user ${socket.user?.id}:`, error);
      socket.emit('error', {
        message: 'Failed to get state',
        code: 'GET_STATE_FAILED',
      });
    }
  }

  @SubscribeMessage('crash:reconnect')
  async handleReconnect(@ConnectedSocket() socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const user = socket.user!;
      const currentGame = await this.crashService.getCurrentGame();
      const userBets = await this.crashService.getUserBets(user.id);

      socket.emit('crash:reconnect_data', {
        type: 'crash:reconnect_data',
        data: {
          gameInfo: currentGame,
          userBets,
        },
        timestamp: new Date(),
      });

      this.logger.log(`Player ${user.id} reconnected to crash room`, {
        activeBets: userBets.length,
      });
    } catch {
      socket.emit('error', {
        message: 'Failed to reconnect',
        code: 'RECONNECT_FAILED',
      });
    }
  }

  @SubscribeMessage('crash:join_room')
  async handleJoinRoom(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: JoinCrashRoomDto,
  ): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      // Join crash room
      await socket.join('crash-game');

      // Send current game state
      const currentGame = await this.crashService.getCurrentGame();
      socket.emit('crash:room_joined', {
        type: 'crash:room_joined',
        data: { gameInfo: currentGame },
        timestamp: new Date(),
      });

      this.logger.log(`User ${data.userId} joined crash room`);
    } catch {
      socket.emit('error', {
        message: 'Failed to join crash room',
        code: 'JOIN_ROOM_FAILED',
      });
    }
  }

  @SubscribeMessage('crash:place_bet')
  async handlePlaceBet(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: PlaceCrashBetWebSocketDto,
  ): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const result = await this.crashService.placeBet(socket.user!, {
        betAmount: data.betAmount,
        autoCashOutAt: data.autoCashOutAt ? parseFloat(data.autoCashOutAt) : undefined,
      });

      socket.emit('crash:bet_confirmed', {
        type: 'crash:bet_confirmed',
        data: result,
        timestamp: new Date(),
      });

      this.logger.log(`User ${data.userId} placed bet in crash game`);
    } catch (error) {
      socket.emit('crash:bet_error', {
        message: error instanceof Error ? error.message : 'Failed to place bet',
        code: 'BET_FAILED',
      });
    }
  }

  @SubscribeMessage('crash:cash_out')
  async handleCashOut(
    @ConnectedSocket() socket: AuthenticatedSocket,
    @MessageBody() data: CashOutWebSocketDto,
  ): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const result = await this.crashService.cashOut(data.userId, data.betId);

      socket.emit('crash:cash_out_confirmed', {
        type: 'crash:cash_out_confirmed',
        data: result,
        timestamp: new Date(),
      });

      this.logger.log(`User ${data.userId} cashed out in crash game`);
    } catch (error) {
      socket.emit('crash:cash_out_error', {
        message: error instanceof Error ? error.message : 'Failed to cash out',
        code: 'CASH_OUT_FAILED',
      });
    }
  }

  @SubscribeMessage('crash:get_balance')
  async handleGetBalance(@ConnectedSocket() socket: AuthenticatedSocket): Promise<void> {
    try {
      if (!this.authService.isAuthenticated(socket)) {
        throw new WsException('Not authenticated');
      }

      const user = socket.user!;
      // Get balance via CrashService
      const { balance, asset } = await this.crashService.getPrimaryWalletBalance(user.id);
      socket.emit('crash:balance_response', {
        type: 'crash:balance_response',
        data: { balance, asset },
        timestamp: new Date(),
      });

      this.logger.log(`User ${user.id} requested primary wallet balance via WebSocket`);
    } catch (error) {
      socket.emit('crash:balance_error', {
        message: error instanceof Error ? error.message : 'Failed to get balance',
        code: 'BALANCE_FAILED',
      });
    }
  }
}
