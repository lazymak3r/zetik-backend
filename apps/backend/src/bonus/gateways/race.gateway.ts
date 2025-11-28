import { Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../../common/services/redis.service';
import { RaceService } from '../services/race.service';

/**
 * RaceGateway - WebSocket support for real-time race leaderboard updates
 *
 * Client can subscribe to ONE race at a time
 * Server broadcasts leaderboard updates every 10 seconds (after wager distribution)
 * Updates are NOT personalized (no user place included in broadcast)
 */
@WebSocketGateway({ cors: true, namespace: '/race' })
export class RaceGateway implements OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RaceGateway.name);

  // Track client subscriptions: Map<socketId, raceId>
  private readonly clientSubscriptions = new Map<string, string>();

  constructor(
    private readonly raceService: RaceService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Subscribe to Redis pub/sub for race leaderboard updates from race-service
   * This enables real-time WebSocket broadcasts when wagers are distributed
   */
  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('🔌 Subscribing to Redis pub/sub: race:leaderboard:update');

      const subscriber = this.redisService.getClient().duplicate();

      await subscriber.subscribe('race:leaderboard:update');

      subscriber.on('message', (channel: string, message: string) => {
        if (channel === 'race:leaderboard:update') {
          try {
            const raceIds = JSON.parse(message) as string[];
            this.logger.log(
              `📡 Received leaderboard update for ${raceIds.length} races via Redis pub/sub`,
            );
            // Fire and forget - don't block Redis message processing
            void this.broadcastLeaderboardUpdates(raceIds);
          } catch (error) {
            this.logger.error('Failed to parse/broadcast race update:', error);
          }
        }
      });

      subscriber.on('error', (error) => {
        this.logger.error('❌ Redis subscriber error:', error);
      });

      this.logger.log('✅ Successfully subscribed to race:leaderboard:update channel');
    } catch (error) {
      this.logger.error('❌ Failed to subscribe to Redis pub/sub:', error);
    }
  }

  /**
   * Subscribe to race leaderboard updates
   *
   * Client can only be subscribed to ONE race at a time
   * Subscribing to new race automatically unsubscribes from previous
   */
  @SubscribeMessage('race:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { raceId: string },
  ): Promise<void> {
    // Unsubscribe from previous race if exists
    const previousRaceId = this.clientSubscriptions.get(client.id);
    if (previousRaceId) {
      await client.leave(`race:${previousRaceId}`);
    }

    try {
      // Subscribe to new race
      await client.join(`race:${data.raceId}`);
      // Update subscription map only after successful join
      this.clientSubscriptions.set(client.id, data.raceId);

      // Send current leaderboard immediately
      try {
        const leaderboard = await this.raceService.getRaceLeaderboard(data.raceId, 100);
        client.emit('race:leaderboard:update', {
          raceId: data.raceId,
          leaderboard,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        this.logger.error(`Error sending initial leaderboard for race ${data.raceId}:`, error);
        client.emit('race:error', {
          message: 'Failed to load leaderboard',
          raceId: data.raceId,
        });
      }
    } catch (error) {
      // If join fails, restore previous subscription
      this.logger.error(`Error joining race ${data.raceId}:`, error);

      if (previousRaceId) {
        try {
          await client.join(`race:${previousRaceId}`);
          this.clientSubscriptions.set(client.id, previousRaceId);
        } catch (restoreError) {
          this.logger.error(`Failed to restore previous subscription:`, restoreError);
          this.clientSubscriptions.delete(client.id);
        }
      }

      client.emit('race:error', {
        message: 'Failed to subscribe to race',
        raceId: data.raceId,
      });
    }
  }

  /**
   * Unsubscribe from race leaderboard updates
   */
  @SubscribeMessage('race:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { raceId: string },
  ): Promise<void> {
    await client.leave(`race:${data.raceId}`);
    this.clientSubscriptions.delete(client.id);
  }

  /**
   * Handle client disconnect
   */
  handleDisconnect(client: Socket): void {
    this.clientSubscriptions.delete(client.id);
  }

  /**
   * Broadcast leaderboard update to all subscribed clients
   * Called by RaceWagerTrackerService every 10 seconds
   *
   * @param raceId - Race to broadcast update for
   */
  async broadcastLeaderboardUpdate(raceId: string): Promise<void> {
    try {
      const leaderboard = await this.raceService.getRaceLeaderboard(raceId, 100);

      const roomName = `race:${raceId}`;

      this.server.to(roomName).emit('race:leaderboard:update', {
        raceId,
        leaderboard,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Error broadcasting leaderboard for race ${raceId}:`, error);
    }
  }

  /**
   * Broadcast updates for multiple races
   * Used after wager distribution to update all touched races
   */
  async broadcastLeaderboardUpdates(raceIds: string[]): Promise<void> {
    await Promise.all(raceIds.map((raceId) => this.broadcastLeaderboardUpdate(raceId)));
  }

  /**
   * Event listener for race leaderboard updates from BetFeedService
   * Replaces direct call from RaceWagerTrackerService
   */
  @OnEvent('race:leaderboard:update')
  async handleRaceLeaderboardUpdate(raceIds: string[]): Promise<void> {
    await this.broadcastLeaderboardUpdates(raceIds);
  }

  /**
   * Cleanup stale subscriptions from disconnected clients
   * Runs every hour to prevent memory leaks from ungraceful disconnects
   */
  @Cron(CronExpression.EVERY_HOUR)
  cleanupStaleSubscriptions(): void {
    const activeSocketIds = new Set(this.server.sockets.sockets.keys());
    let cleanedCount = 0;

    for (const [socketId] of this.clientSubscriptions) {
      if (!activeSocketIds.has(socketId)) {
        this.clientSubscriptions.delete(socketId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} stale subscription(s)`);
    }
  }
}
