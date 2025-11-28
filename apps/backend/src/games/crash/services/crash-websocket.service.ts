import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CrashBetEntity, CrashGameEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import {
  CrashBetPlacedDto,
  CrashCashOutDto,
  CrashGameCrashedDto,
  CrashGameStateDto,
  CrashMultiplierUpdateDto,
} from '../../../websocket/dto/crash-events.dto';
import { CrashEvent, CrashRoomState } from '../events/crash-events';
import { CrashGateway } from '../gateways/crash.gateway.simple';

export interface CrashPlayer {
  userId: string;
  username?: string;
  socketId: string;
  joinedAt: Date;
  activeBetId?: string;
}

@Injectable()
export class CrashWebSocketService {
  private readonly logger = new Logger(CrashWebSocketService.name);
  private multiplierUpdateThrottle = new Map<string, number>();

  // Active players in crash room
  private crashPlayers = new Map<string, CrashPlayer>();

  // Socket to user mapping
  private socketToUser = new Map<string, string>();

  constructor(
    @InjectRepository(CrashBetEntity)
    private readonly crashBetRepository: Repository<CrashBetEntity>,
    @Inject(forwardRef(() => CrashGateway))
    private readonly crashGateway: CrashGateway,
  ) {}

  /**
   * Add player to crash room
   */
  addPlayer(userId: string, socketId: string, username?: string): void {
    const existingPlayer = this.crashPlayers.get(userId);

    if (existingPlayer) {
      // Update socket ID if player reconnects
      this.socketToUser.delete(existingPlayer.socketId);
      existingPlayer.socketId = socketId;
    } else {
      this.crashPlayers.set(userId, {
        userId,
        username,
        socketId,
        joinedAt: new Date(),
      });
    }

    this.socketToUser.set(socketId, userId);

    this.logger.log(`Player ${userId} joined crash room`, {
      userId,
      socketId,
      playersCount: this.crashPlayers.size,
    });
  }

  /**
   * Remove player from crash room
   */
  removePlayer(socketId: string): CrashPlayer | null {
    const userId = this.socketToUser.get(socketId);

    if (!userId) {
      return null;
    }

    const player = this.crashPlayers.get(userId);

    if (player) {
      this.crashPlayers.delete(userId);
      this.socketToUser.delete(socketId);

      this.logger.log(`Player ${userId} left crash room`, {
        userId,
        socketId,
        playersCount: this.crashPlayers.size,
      });
    }

    return player || null;
  }

  /**
   * Get player by socket ID
   */
  getPlayerBySocket(socketId: string): CrashPlayer | null {
    const userId = this.socketToUser.get(socketId);
    return userId ? this.crashPlayers.get(userId) || null : null;
  }

  /**
   * Get player by user ID
   */
  getPlayer(userId: string): CrashPlayer | null {
    return this.crashPlayers.get(userId) || null;
  }

  /**
   * Get all active players
   */
  getActivePlayers(): CrashPlayer[] {
    return Array.from(this.crashPlayers.values());
  }

  /**
   * Get players count
   */
  getPlayersCount(): number {
    return this.crashPlayers.size;
  }

  /**
   * Update player's active bet
   */
  updatePlayerBet(userId: string, betId: string | undefined): void {
    const player = this.crashPlayers.get(userId);

    if (player) {
      player.activeBetId = betId;
    }
  }

  /**
   * Get socket IDs of all players
   */
  getAllSocketIds(): string[] {
    return Array.from(this.crashPlayers.values()).map((player) => player.socketId);
  }

  /**
   * Get socket ID by user ID
   */
  getSocketIdByUserId(userId: string): string | null {
    const player = this.crashPlayers.get(userId);
    return player?.socketId || null;
  }

  /**
   * Build current room state
   */
  async buildRoomState(currentGame: CrashGameEntity | null): Promise<CrashRoomState | null> {
    if (!currentGame) {
      return null;
    }

    // Get active bets for current game
    const activeBets = await this.crashBetRepository.find({
      where: { crashGameId: currentGame.id },
    });

    // Get bet statistics
    const totalBetAmount = activeBets
      .reduce((sum, bet) => sum + parseFloat(bet.betAmount), 0)
      .toString();

    return {
      gameId: currentGame.id,
      status: currentGame.status,
      currentMultiplier: undefined, // Will be set by caller if game is flying
      crashPoint: currentGame.crashPoint,
      betsCount: activeBets.length,
      totalBetAmount,
      activeBets: activeBets.map((bet) => ({
        userId: bet.userId,
        betAmount: bet.betAmount,
        autoCashOutAt: bet.autoCashOutAt,
        status: bet.status,
      })),
      playerCount: this.getPlayersCount(),
    };
  }

  /**
   * Create crash event
   */
  createEvent<T extends CrashEvent>(type: T['type'], data: T['data']): T {
    return {
      type,
      data,
      timestamp: new Date(),
    } as T;
  }

  broadcastGameState(gameState: CrashGameStateDto): void {
    try {
      this.crashGateway.server.to('crash-game').emit('crash:game_state', {
        type: 'crash:game_state',
        data: gameState,
        timestamp: new Date(),
      });

      this.logger.debug(
        `Broadcasted game state for game ${gameState.id} (${gameState.status}, ${gameState.betsCount} bets)`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast game state: ${error}`, {
        gameId: gameState.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  broadcastMultiplierUpdate(update: CrashMultiplierUpdateDto): void {
    try {
      // Throttle updates to prevent spam - Don't need to throttle because we're using 100ms interval
      // const now = Date.now();
      // const lastUpdate = this.multiplierUpdateThrottle.get(update.gameId) || 0;

      // // Allow max 10 updates per second
      // if (now - lastUpdate < 100) {
      //   return;
      // }

      // this.multiplierUpdateThrottle.set(update.gameId, now);

      this.crashGateway.server.to('crash-game').emit('crash:multiplier_update', {
        type: 'crash:multiplier_update',
        data: update,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to broadcast multiplier update: ${error}`, {
        gameId: update.gameId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  broadcastBetPlaced(bet: CrashBetPlacedDto): void {
    try {
      this.crashGateway.server.to('crash-game').emit('crash:bet_placed', {
        type: 'crash:bet_placed',
        data: bet,
        timestamp: new Date(),
      });

      this.logger.debug(
        `Broadcasted bet placed for game ${bet.gameId} (user: ${bet.userId}, amount: ${bet.betAmount})`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast bet placed: ${error}`, {
        gameId: bet.gameId,
        userId: bet.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  broadcastCashOut(cashOut: CrashCashOutDto): void {
    try {
      this.crashGateway.server.to('crash-game').emit('crash:cash_out', {
        type: 'crash:cash_out',
        data: cashOut,
        timestamp: new Date(),
      });

      this.logger.debug(
        `Broadcasted cash out for game ${cashOut.gameId} (user: ${cashOut.userId}, ${cashOut.multiplier}x, win: ${cashOut.winAmount})`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast cash out: ${error}`, {
        gameId: cashOut.gameId,
        userId: cashOut.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  broadcastGameCrashed(crashed: CrashGameCrashedDto): void {
    try {
      // Backward-compatible payload: keep new fields, also provide legacy fields expected by UI
      const legacyTimestamp = (() => {
        const parsed = crashed.crashedAt ? Date.parse(crashed.crashedAt) : Date.now();
        return Number.isNaN(parsed) ? Date.now() : parsed;
      })();

      const payload = {
        ...crashed,
        gameId: crashed.id,
        timestamp: legacyTimestamp,
      } as unknown as CrashGameCrashedDto & { gameId: string; timestamp: number };

      this.crashGateway.server.to('crash-game').emit('crash:game_crashed', {
        type: 'crash:game_crashed',
        data: payload,
        timestamp: new Date(),
      });

      // Clear throttle cache for this game
      this.multiplierUpdateThrottle.delete(crashed.id);

      this.logger.debug(
        `Broadcasted game crashed for game ${crashed.id} at ${crashed.crashPoint}x`,
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast game crashed: ${error}`, {
        gameId: crashed.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async broadcastGameCrashedExcludeUsers(
    crashed: CrashGameCrashedDto,
    excludeUserIds: Set<string>,
  ): Promise<void> {
    try {
      // Backward-compatible payload: keep new fields, also provide legacy fields expected by UI
      const legacyTimestamp = (() => {
        const parsed = crashed.crashedAt ? Date.parse(crashed.crashedAt) : Date.now();
        return Number.isNaN(parsed) ? Date.now() : parsed;
      })();

      const payload = {
        ...crashed,
        gameId: crashed.id,
        timestamp: legacyTimestamp,
      } as unknown as CrashGameCrashedDto & { gameId: string; timestamp: number };

      // Get all connected sockets in the crash-game room
      const sockets = await this.crashGateway.server.in('crash-game').fetchSockets();

      // Send to sockets that don't belong to excluded users
      for (const socket of sockets) {
        // Check both socket.userId (set by auth service) and socket.data.userId (backup)
        const authSocket = socket as any;
        const socketUserId = authSocket.userId || socket.data?.userId;

        // Send to users who didn't participate in the game (or unauthenticated users)
        if (!socketUserId || !excludeUserIds.has(socketUserId)) {
          socket.emit('crash:game_crashed', {
            type: 'crash:game_crashed',
            data: payload,
            timestamp: new Date(),
          });
        }
      }

      // Clear throttle cache for this game
      this.multiplierUpdateThrottle.delete(crashed.id);

      this.logger.warn(
        `📢 WEBSOCKET DEBUG: Broadcasted general crash event for game ${crashed.id} at ${crashed.crashPoint}x excluding ${excludeUserIds.size} participating users`,
        { excludedUserIds: Array.from(excludeUserIds) },
      );
    } catch (error) {
      this.logger.error(`Failed to broadcast game crashed with exclusions: ${error}`, {
        gameId: crashed.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendToUser(userId: string, event: string, data: unknown): Promise<void> {
    try {
      // Find socket by userId and send direct message
      const sockets = await this.crashGateway.server.fetchSockets();

      // Debug: Log all socket user IDs
      this.logger.warn(
        `🔍 WEBSOCKET DEBUG: Looking for user ${userId} among ${sockets.length} connected sockets`,
      );
      sockets.forEach((socket, index) => {
        const authSocket = socket as any;
        const socketUserId = authSocket.userId || socket.data?.userId;
        this.logger.warn(`Socket ${index}: userId=${socketUserId}, socketId=${socket.id}`);
      });

      const userSocket = sockets.find((socket) => {
        // Check both socket.userId (set by auth service) and socket.data.userId (backup)
        const authSocket = socket as any;
        return authSocket.userId === userId || socket.data?.userId === userId;
      });

      if (userSocket) {
        // For crash:game_crashed events, ensure legacy compatibility
        let payload = data;
        if (event === 'crash:game_crashed' && typeof data === 'object' && data !== null) {
          const crashData = data as any;
          // Add legacy fields if they don't exist
          payload = {
            ...crashData,
            gameId: crashData.gameId || crashData.id,
            timestamp:
              crashData.timestamp ||
              (crashData.crashedAt ? Date.parse(crashData.crashedAt) : Date.now()),
          };
        }

        userSocket.emit(event, {
          type: event,
          data: payload,
          timestamp: new Date(),
        });

        this.logger.warn(`✅ WEBSOCKET DEBUG: Sent direct message to user ${userId} (${event})`, {
          userId,
          event,
          hasUserSpecificData:
            typeof data === 'object' && data !== null && 'isUserBetWin' in (data as any),
          dataKeys: typeof data === 'object' && data !== null ? Object.keys(data as any) : [],
        });
      } else {
        this.logger.warn(`Socket not found for user ${userId} when sending ${event}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send message to user: ${error}`, {
        userId,
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Clean up throttle cache periodically
   */
  cleanupThrottleCache(): void {
    const now = Date.now();
    for (const [gameId, lastUpdate] of this.multiplierUpdateThrottle.entries()) {
      // Remove entries older than 1 minute
      if (now - lastUpdate > 60000) {
        this.multiplierUpdateThrottle.delete(gameId);
      }
    }
  }
}
