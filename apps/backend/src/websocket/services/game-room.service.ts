import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { GameTypeEnum } from '@zetik/shared-entities';
import { Server } from 'socket.io';
import { AuthenticatedSocket } from './websocket-auth.service';

export interface GameRoom {
  id: string;
  gameType: GameTypeEnum;
  players: Map<string, PlayerInfo>;
  state: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: Date;
  gameData?: any;
}

export interface PlayerInfo {
  userId: string;
  socketId: string;
  username: string;
  joinedAt: Date;
  isActive: boolean;
}

export interface GameUpdate {
  type:
    | 'game_start'
    | 'game_update'
    | 'game_end'
    | 'player_action'
    | 'player_join'
    | 'player_leave';
  data: any;
  timestamp: Date;
}

@Injectable()
export class GameRoomService implements OnModuleDestroy {
  private readonly logger = new Logger(GameRoomService.name);
  private readonly rooms = new Map<string, GameRoom>();
  private readonly playerRooms = new Map<string, string>(); // userId -> roomId
  private readonly socketRooms = new Map<string, string>(); // socketId -> roomId
  private readonly cleanupTimeouts = new Map<string, NodeJS.Timeout>(); // userId -> timeoutId for tracking

  /**
   * Create a new game room
   */
  createRoom(gameType: GameTypeEnum, maxPlayers: number = 100): GameRoom {
    const roomId = this.generateRoomId(gameType);

    const room: GameRoom = {
      id: roomId,
      gameType,
      players: new Map(),
      state: 'waiting',
      maxPlayers,
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);

    this.logger.log(`Created game room ${roomId} for ${gameType}`, {
      roomId,
      gameType,
      maxPlayers,
    });

    return room;
  }

  /**
   * Join a player to a game room
   */
  joinRoom(socket: AuthenticatedSocket, gameType: GameTypeEnum): GameRoom {
    const userId = socket.userId!;
    const user = socket.user!;

    // Check if user is already in a room
    const existingRoomId = this.playerRooms.get(userId);
    if (existingRoomId) {
      const existingRoom = this.rooms.get(existingRoomId);
      if (existingRoom && existingRoom.gameType === gameType) {
        // Rejoin existing room
        void socket.join(existingRoomId);
        this.socketRooms.set(socket.id, existingRoomId);

        // Update player info
        const playerInfo = existingRoom.players.get(userId.toString());
        if (playerInfo) {
          playerInfo.socketId = socket.id;
          playerInfo.isActive = true;
        }

        this.logger.log(`User ${userId} rejoined room ${existingRoomId}`);
        return existingRoom;
      } else {
        // Leave old room if different game type
        this.leaveRoom(socket);
      }
    }

    // Find or create a suitable room
    let room = this.findAvailableRoom(gameType);
    if (!room) {
      room = this.createRoom(gameType);
    }

    // Add player to room
    const playerInfo: PlayerInfo = {
      userId,
      socketId: socket.id,
      username: user.username || `User${userId.slice(-6)}`, // Use actual username, fallback to last 6 chars of userId
      joinedAt: new Date(),
      isActive: true,
    };

    room.players.set(userId, playerInfo);
    this.playerRooms.set(userId, room.id);
    this.socketRooms.set(socket.id, room.id);

    // Join socket to room
    void socket.join(room.id);

    // Notify other players
    socket.to(room.id).emit('player_joined', {
      type: 'player_join',
      data: {
        userId,
        username: playerInfo.username,
        playersCount: room.players.size,
      },
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} joined room ${room.id}`, {
      roomId: room.id,
      gameType,
      playersCount: room.players.size,
    });

    return room;
  }

  /**
   * Remove a player from their current room
   */
  leaveRoom(socket: AuthenticatedSocket): void {
    const socketId = socket.id;
    const userId = socket.userId;

    const roomId = this.socketRooms.get(socketId);
    if (!roomId) {
      return; // Not in any room
    }

    const room = this.rooms.get(roomId);
    if (!room || !userId) {
      return;
    }

    // Clear any pending cleanup timeout for this user
    const timeoutId = this.cleanupTimeouts.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.cleanupTimeouts.delete(userId);
    }

    // Remove player from room
    room.players.delete(userId.toString());
    this.playerRooms.delete(userId);
    this.socketRooms.delete(socketId);

    // Leave socket room
    void socket.leave(roomId);

    // Notify other players
    socket.to(roomId).emit('player_left', {
      type: 'player_leave',
      data: {
        userId,
        playersCount: room.players.size,
      },
      timestamp: new Date(),
    });

    this.logger.log(`User ${userId} left room ${roomId}`, {
      roomId,
      playersCount: room.players.size,
    });

    // Clean up empty rooms
    if (room.players.size === 0 && room.state === 'waiting') {
      this.rooms.delete(roomId);
      this.logger.log(`Cleaned up empty room ${roomId}`);
    }
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnect(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    const socketId = socket.id;

    if (!userId) {
      return;
    }

    const roomId = this.socketRooms.get(socketId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const playerInfo = room.players.get(userId.toString());
        if (playerInfo) {
          // Mark player as inactive instead of removing immediately
          playerInfo.isActive = false;

          // Notify other players
          socket.to(roomId).emit('player_disconnected', {
            type: 'player_leave',
            data: {
              userId,
              isDisconnect: true,
              playersCount: room.players.size,
            },
            timestamp: new Date(),
          });

          this.logger.log(`User ${userId} disconnected from room ${roomId}`, {
            roomId,
            socketId,
          });

          // Clean up inactive players after 5 minutes
          const timeoutId = setTimeout(
            () => {
              this.cleanupInactivePlayer(userId, roomId);
              this.cleanupTimeouts.delete(userId); // Remove from tracking
            },
            5 * 60 * 1000,
          );

          // Track timeout for cleanup
          this.cleanupTimeouts.set(userId, timeoutId);
        }
      }
    }

    this.socketRooms.delete(socketId);
  }

  /**
   * Broadcast update to all players in a room
   */
  broadcastToRoom(roomId: string, event: string, data: GameUpdate, server: Server): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    server.to(roomId).emit(event, data);

    this.logger.debug(`Broadcasted ${event} to room ${roomId}`, {
      roomId,
      playersCount: room.players.size,
      eventType: data.type,
    });
  }

  /**
   * Send update to specific player in a room
   */
  sendToPlayer(userId: string, event: string, data: GameUpdate, server: Server): void {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) {
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const playerInfo = room.players.get(userId.toString());
    if (!playerInfo || !playerInfo.isActive) {
      return;
    }

    server.to(playerInfo.socketId).emit(event, data);
  }

  /**
   * Get room by ID
   */
  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get room by user ID
   */
  getRoomByUserId(userId: string): GameRoom | undefined {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) {
      return undefined;
    }
    return this.rooms.get(roomId);
  }

  /**
   * Get all rooms for a game type
   */
  getRoomsByGameType(gameType: GameTypeEnum): GameRoom[] {
    return Array.from(this.rooms.values()).filter((room) => room.gameType === gameType);
  }

  /**
   * Update room state
   */
  updateRoomState(roomId: string, state: GameRoom['state'], gameData?: unknown): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.state = state;
      if (gameData !== undefined) {
        room.gameData = gameData;
      }
    }
  }

  /**
   * Find an available room for joining
   */
  private findAvailableRoom(gameType: GameTypeEnum): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (
        room.gameType === gameType &&
        room.state === 'waiting' &&
        room.players.size < room.maxPlayers
      ) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Generate unique room ID
   */
  private generateRoomId(gameType: GameTypeEnum): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${gameType.toLowerCase()}_${timestamp}_${random}`;
  }

  /**
   * Clean up inactive players
   */
  private cleanupInactivePlayer(userId: string, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    const playerInfo = room.players.get(userId.toString());
    if (playerInfo && !playerInfo.isActive) {
      room.players.delete(userId.toString());
      this.playerRooms.delete(userId);

      this.logger.log(`Cleaned up inactive player ${userId} from room ${roomId}`);

      // Clean up empty rooms
      if (room.players.size === 0 && room.state === 'waiting') {
        this.rooms.delete(roomId);
        this.logger.log(`Cleaned up empty room ${roomId}`);
      }
    }
  }

  /**
   * Clean up all timeouts on module destroy to prevent memory leaks
   */
  onModuleDestroy(): void {
    // Clear all pending cleanup timeouts
    for (const [userId, timeoutId] of this.cleanupTimeouts.entries()) {
      clearTimeout(timeoutId);
      this.logger.log(`Cleared cleanup timeout for user ${userId}`);
    }
    this.cleanupTimeouts.clear();
    this.logger.log('Game room service cleanup completed');
  }
}
