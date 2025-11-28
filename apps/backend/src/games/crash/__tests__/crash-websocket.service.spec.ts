import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CrashBetEntity, CrashGameEntity, CrashGameStatusEnum } from '@zetik/shared-entities';
import { CrashEventType } from '../events/crash-events';
import { CrashGateway } from '../gateways/crash.gateway.simple';
import { CrashWebSocketService } from '../services/crash-websocket.service';

describe('CrashWebSocketService', () => {
  let service: CrashWebSocketService;

  const mockCrashBetRepository = {
    find: jest.fn(),
  };

  const mockCrashGameRepository = {
    findOne: jest.fn(),
  };

  const mockCrashGateway = {
    server: {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrashWebSocketService,
        {
          provide: getRepositoryToken(CrashBetEntity),
          useValue: mockCrashBetRepository,
        },
        {
          provide: getRepositoryToken(CrashGameEntity),
          useValue: mockCrashGameRepository,
        },
        {
          provide: CrashGateway,
          useValue: mockCrashGateway,
        },
      ],
    }).compile();

    service = module.get<CrashWebSocketService>(CrashWebSocketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Player Management', () => {
    it('should add player to crash room', () => {
      const userId = 'user-1';
      const socketId = 'socket-1';
      const username = 'testuser';

      service.addPlayer(userId, socketId, username);

      const player = service.getPlayer(userId);
      expect(player).toBeDefined();
      expect(player?.userId).toBe(userId);
      expect(player?.socketId).toBe(socketId);
      expect(player?.username).toBe(username);
      expect(service.getPlayersCount()).toBe(1);
    });

    it('should update socket ID when player reconnects', () => {
      const userId = 'user-1';
      const oldSocketId = 'socket-1';
      const newSocketId = 'socket-2';

      service.addPlayer(userId, oldSocketId);
      service.addPlayer(userId, newSocketId);

      const player = service.getPlayer(userId);
      expect(player?.socketId).toBe(newSocketId);
      expect(service.getPlayersCount()).toBe(1);
    });

    it('should remove player from crash room', () => {
      const userId = 'user-1';
      const socketId = 'socket-1';

      service.addPlayer(userId, socketId);
      const removedPlayer = service.removePlayer(socketId);

      expect(removedPlayer?.userId).toBe(userId);
      expect(service.getPlayer(userId)).toBeNull();
      expect(service.getPlayersCount()).toBe(0);
    });

    it('should return null when removing non-existent player', () => {
      const removedPlayer = service.removePlayer('non-existent-socket');
      expect(removedPlayer).toBeNull();
    });

    it('should get player by socket ID', () => {
      const userId = 'user-1';
      const socketId = 'socket-1';

      service.addPlayer(userId, socketId);
      const player = service.getPlayerBySocket(socketId);

      expect(player?.userId).toBe(userId);
    });

    it('should update player active bet', () => {
      const userId = 'user-1';
      const socketId = 'socket-1';
      const betId = 'bet-1';

      service.addPlayer(userId, socketId);
      service.updatePlayerBet(userId, betId);

      const player = service.getPlayer(userId);
      expect(player?.activeBetId).toBe(betId);
    });

    it('should get all socket IDs', () => {
      service.addPlayer('user-1', 'socket-1');
      service.addPlayer('user-2', 'socket-2');

      const socketIds = service.getAllSocketIds();
      expect(socketIds).toHaveLength(2);
      expect(socketIds).toContain('socket-1');
      expect(socketIds).toContain('socket-2');
    });
  });

  describe('Room State', () => {
    it('should build room state with current game', async () => {
      const mockGame: CrashGameEntity = {
        id: 'game-1',
        status: CrashGameStatusEnum.WAITING,
        crashPoint: '2.50',
        serverSeedHash: 'hash',
        nonce: '1',
        createdAt: new Date(),
        updatedAt: new Date(),
        startedAt: undefined,
        crashedAt: undefined,
        endedAt: undefined,
        serverSeed: 'seed',
        gameData: {
          totalBets: 2,
          totalBetAmount: '100',
          totalWinAmount: '0',
          maxMultiplier: '2.50',
          playerCount: 2,
        },
        bets: [],
      };

      const mockBets = [
        {
          id: 'bet-1',
          userId: 'user-1',
          betAmount: '50',
          autoCashOutAt: '2.00',
          status: 'ACTIVE',
          user: { username: 'user1' },
        },
        {
          id: 'bet-2',
          userId: 'user-2',
          betAmount: '50',
          autoCashOutAt: null,
          status: 'ACTIVE',
          user: { username: 'user2' },
        },
      ];

      mockCrashBetRepository.find.mockResolvedValue(mockBets);

      service.addPlayer('user-1', 'socket-1');
      service.addPlayer('user-2', 'socket-2');

      const roomState = await service.buildRoomState(mockGame);

      expect(roomState).toBeDefined();
      expect(roomState?.gameId).toBe('game-1');
      expect(roomState?.status).toBe(CrashGameStatusEnum.WAITING);
      expect(roomState?.betsCount).toBe(2);
      expect(roomState?.totalBetAmount).toBe('100');
      expect(roomState?.playerCount).toBe(2);
      expect(roomState?.activeBets).toHaveLength(2);
    });

    it('should return null for null game', async () => {
      const roomState = await service.buildRoomState(null);
      expect(roomState).toBeNull();
    });
  });

  describe('Event Creation', () => {
    it('should create crash event with correct structure', () => {
      const eventType = CrashEventType.GAME_WAITING;
      const eventData = {
        gameId: 'game-1',
        status: 'WAITING',
        betsCount: 0,
        totalBetAmount: '0',
        serverSeedHash: 'hash123',
        nonce: '1',
      };

      const event = service.createEvent(eventType, eventData);

      expect(event.type).toBe(eventType);
      expect(event.data).toEqual(eventData);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });
});
