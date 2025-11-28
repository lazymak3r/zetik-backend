import {
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { commonConfig } from '../../config/common.config';
import { WebSocketExceptionFilter } from '../filters/websocket-exception.filter';
import { OnlineStatsService } from '../services/online-stats.service';

@WebSocketGateway({
  cors: {
    origin: commonConfig().corsOrigins,
    credentials: true,
  },
  namespace: '/stats',
})
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class StatsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StatsGateway.name);
  private statsInterval?: NodeJS.Timeout;
  private readonly STATS_INTERVAL_MS = 25000; // 25 seconds

  constructor(private readonly onlineStatsService: OnlineStatsService) {}

  /**
   * Initialize module and start stats broadcast interval
   * Note: Activity tracking is handled by /bet-feed gateway
   */
  onModuleInit(): void {
    // Start stats broadcast interval
    this.startStatsUpdates();
  }

  /**
   * Cleanup when module is destroyed
   */
  onModuleDestroy(): void {
    this.stopStatsUpdates();
  }

  /**
   * Handle new WebSocket connection - no authentication required for stats
   * Activity tracking is done in /bet-feed gateway
   * This gateway only broadcasts active user statistics
   */
  async handleConnection(socket: Socket): Promise<void> {
    try {
      // Send current stats immediately upon connection
      const currentStats = await this.onlineStatsService.getActiveUserCount();
      socket.emit('online-stats', currentStats);

      // Send welcome message
      socket.emit('connected', {
        message: 'Connected to stats server',
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn(
        `Stats WebSocket connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          socketId: socket.id,
          ip: socket.handshake.address,
        },
      );

      socket.emit('error', {
        message: 'Connection failed',
        code: 'CONNECTION_FAILED',
      });

      socket.disconnect();
    }
  }

  /**
   * Handle WebSocket disconnection
   * Activity tracking is done in /bet-feed gateway
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  handleDisconnect(_socket: Socket): void {
    // Silent disconnect
  }

  /**
   * Start stats broadcast every 25 seconds to all connected clients
   */
  private startStatsUpdates(): void {
    this.statsInterval = setInterval(() => {
      void (async () => {
        try {
          const stats = await this.onlineStatsService.getActiveUserCount();

          // Broadcast to all connected clients
          this.server.emit('online-stats', stats);
        } catch (error) {
          this.logger.error('Failed to broadcast stats update', error);
        }
      })();
    }, this.STATS_INTERVAL_MS);
  }

  /**
   * Stop stats broadcast interval
   */
  private stopStatsUpdates(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = undefined;
    }
  }
}
