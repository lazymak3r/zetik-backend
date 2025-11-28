import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { createTestProviders } from '../../../test-utils/common-providers';
import { RaceService } from '../../services/race.service';
import { RaceGateway } from '../race.gateway';

describe('RaceGateway', () => {
  let gateway: RaceGateway;
  let mockRaceService: jest.Mocked<RaceService>;
  let mockSocket: jest.Mocked<Socket>;
  let mockServer: jest.Mocked<Server>;

  beforeEach(async () => {
    const mockRace = {
      getRaceLeaderboard: jest.fn().mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        status: 'ACTIVE',
        startsAt: '2025-01-01T00:00:00Z',
        endTime: '2025-01-08T00:00:00Z',
        prizePool: 1000,
        winnersCount: 3,
        asset: null,
        fiat: 'USD',
        sponsorId: null,
        referralCode: null,
        leaderboard: [],
        participantsCount: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceGateway,
        ...createTestProviders(),
        {
          provide: RaceService,
          useValue: mockRace,
        },
      ],
    }).compile();

    gateway = module.get<RaceGateway>(RaceGateway);
    mockRaceService = module.get(RaceService);

    // Mock Socket.IO socket
    mockSocket = {
      id: 'socket-123',
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      rooms: new Set(['socket-123']),
    } as any;

    // Mock Socket.IO server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      sockets: {
        sockets: new Map([
          ['socket-123', mockSocket],
          ['socket-456', {} as Socket],
        ]),
      } as any,
    } as any;

    gateway.server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSubscribe', () => {
    const subscribeData = { raceId: 'race-1' };

    it('should successfully subscribe to race room', async () => {
      await gateway.handleSubscribe(mockSocket, subscribeData);

      expect(mockSocket.join).toHaveBeenCalledWith('race:race-1');
      expect(mockRaceService.getRaceLeaderboard).toHaveBeenCalledWith('race-1', 100);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'race:leaderboard:update',
        expect.objectContaining({
          raceId: 'race-1',
          leaderboard: expect.any(Object),
        }),
      );
    });

    it('should update subscription map only after successful join', async () => {
      await gateway.handleSubscribe(mockSocket, subscribeData);

      // Internal subscription map should be updated
      expect(gateway['clientSubscriptions'].get(mockSocket.id)).toBe('race-1');
    });

    it('should unsubscribe from previous race before subscribing to new one', async () => {
      // First subscription
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-1' });

      // Clear mocks
      jest.clearAllMocks();

      // Second subscription to different race
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-2' });

      expect(mockSocket.leave).toHaveBeenCalledWith('race:race-1');
      expect(mockSocket.join).toHaveBeenCalledWith('race:race-2');
    });

    it('should restore previous subscription if new subscription fails', async () => {
      // First subscription succeeds
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-1' });

      // Second subscription fails
      mockSocket.join.mockRejectedValueOnce(new Error('Room join failed'));

      await gateway.handleSubscribe(mockSocket, { raceId: 'race-2' });

      // Should restore previous subscription
      expect(mockSocket.join).toHaveBeenCalledWith('race:race-1');
      expect(gateway['clientSubscriptions'].get(mockSocket.id)).toBe('race-1');
    });

    it('should emit error if subscription fails and cannot restore', async () => {
      mockSocket.join.mockRejectedValue(new Error('Connection error'));

      await gateway.handleSubscribe(mockSocket, subscribeData);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'race:error',
        expect.objectContaining({
          message: 'Failed to subscribe to race',
          raceId: 'race-1',
        }),
      );
    });

    it('should handle getRaceLeaderboard errors gracefully', async () => {
      mockRaceService.getRaceLeaderboard.mockRejectedValueOnce(new Error('Race not found'));

      await gateway.handleSubscribe(mockSocket, subscribeData);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'race:error',
        expect.objectContaining({
          message: 'Failed to load leaderboard',
          raceId: 'race-1',
        }),
      );
    });

    it('should remove subscription from map if join fails and no previous subscription', async () => {
      mockSocket.join.mockRejectedValue(new Error('Join failed'));

      await gateway.handleSubscribe(mockSocket, subscribeData);

      // Subscription map should be cleaned up
      expect(gateway['clientSubscriptions'].has(mockSocket.id)).toBe(false);
    });
  });

  describe('handleDisconnect', () => {
    it('should remove client from subscription map on disconnect', () => {
      // Add subscription
      gateway['clientSubscriptions'].set(mockSocket.id, 'race-1');

      gateway.handleDisconnect(mockSocket);

      expect(gateway['clientSubscriptions'].has(mockSocket.id)).toBe(false);
    });

    it('should handle disconnect for non-subscribed client', () => {
      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  describe('cleanupStaleSubscriptions', () => {
    it('should remove disconnected client subscriptions', () => {
      // Add subscriptions for connected and disconnected clients
      gateway['clientSubscriptions'].set('socket-123', 'race-1'); // Connected
      gateway['clientSubscriptions'].set('socket-456', 'race-2'); // Connected
      gateway['clientSubscriptions'].set('socket-999', 'race-3'); // Disconnected
      gateway['clientSubscriptions'].set('socket-888', 'race-4'); // Disconnected

      gateway.cleanupStaleSubscriptions();

      // Only connected clients should remain
      expect(gateway['clientSubscriptions'].size).toBe(2);
      expect(gateway['clientSubscriptions'].has('socket-123')).toBe(true);
      expect(gateway['clientSubscriptions'].has('socket-456')).toBe(true);
      expect(gateway['clientSubscriptions'].has('socket-999')).toBe(false);
      expect(gateway['clientSubscriptions'].has('socket-888')).toBe(false);
    });

    it('should log cleanup count when stale subscriptions removed', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');

      gateway['clientSubscriptions'].set('socket-999', 'race-1');
      gateway['clientSubscriptions'].set('socket-888', 'race-2');

      gateway.cleanupStaleSubscriptions();

      expect(loggerSpy).toHaveBeenCalledWith('Cleaned up 2 stale subscription(s)');
    });

    it('should not log if no stale subscriptions found', () => {
      const loggerSpy = jest.spyOn(gateway['logger'], 'log');

      gateway['clientSubscriptions'].set('socket-123', 'race-1');
      gateway['clientSubscriptions'].set('socket-456', 'race-2');

      gateway.cleanupStaleSubscriptions();

      expect(loggerSpy).not.toHaveBeenCalledWith(expect.stringContaining('Cleaned up'));
    });

    it('should handle empty subscription map', () => {
      gateway['clientSubscriptions'].clear();

      expect(() => gateway.cleanupStaleSubscriptions()).not.toThrow();
      expect(gateway['clientSubscriptions'].size).toBe(0);
    });
  });

  describe('broadcastLeaderboardUpdate', () => {
    it('should broadcast to specific race room', async () => {
      mockRaceService.getRaceLeaderboard.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test',
        status: 'ACTIVE' as any,
        startsAt: '2025-01-01T00:00:00Z',
        endTime: '2025-01-08T00:00:00Z',
        prizePool: 1000,
        winnersCount: 3,
        asset: null,
        fiat: 'USD',
        sponsorId: null,
        referralCode: null,
        leaderboard: [],
        participantsCount: 0,
      });

      await gateway.broadcastLeaderboardUpdate('race-1');

      expect(mockRaceService.getRaceLeaderboard).toHaveBeenCalledWith('race-1', 100);
    });

    it('should handle broadcast errors gracefully', async () => {
      mockRaceService.getRaceLeaderboard.mockRejectedValue(new Error('Race not found'));

      await expect(gateway.broadcastLeaderboardUpdate('race-1')).resolves.not.toThrow();
    });
  });

  describe('Concurrent Subscription Management', () => {
    it('should handle multiple clients subscribing to same race', async () => {
      const socket1: any = { ...mockSocket, id: 'socket-1', join: jest.fn(), emit: jest.fn() };
      const socket2: any = { ...mockSocket, id: 'socket-2', join: jest.fn(), emit: jest.fn() };

      await Promise.all([
        gateway.handleSubscribe(socket1, { raceId: 'race-1' }),
        gateway.handleSubscribe(socket2, { raceId: 'race-1' }),
      ]);

      expect(gateway['clientSubscriptions'].get('socket-1')).toBe('race-1');
      expect(gateway['clientSubscriptions'].get('socket-2')).toBe('race-1');
      expect(socket1.join).toHaveBeenCalledWith('race:race-1');
      expect(socket2.join).toHaveBeenCalledWith('race:race-1');
    });

    it('should handle rapid subscription changes from single client', async () => {
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-1' });
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-2' });
      await gateway.handleSubscribe(mockSocket, { raceId: 'race-3' });

      // Should end up subscribed to race-3
      expect(gateway['clientSubscriptions'].get(mockSocket.id)).toBe('race-3');
      expect(mockSocket.join).toHaveBeenLastCalledWith('race:race-3');
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not accumulate subscriptions for disconnected clients', () => {
      // Add the "connected" clients first (socket-123 and socket-456 from mockServer.sockets.sockets)
      gateway['clientSubscriptions'].set('socket-123', 'race-1');
      gateway['clientSubscriptions'].set('socket-456', 'race-1');

      // Simulate 100 disconnected clients
      for (let i = 0; i < 100; i++) {
        gateway['clientSubscriptions'].set(`socket-disconnected-${i}`, 'race-1');
      }

      expect(gateway['clientSubscriptions'].size).toBe(102);

      // Run cleanup (only socket-123 and socket-456 are "connected" in mockServer)
      gateway.cleanupStaleSubscriptions();

      // Should only have 2 subscriptions left (the connected ones)
      expect(gateway['clientSubscriptions'].size).toBe(2);
      expect(gateway['clientSubscriptions'].has('socket-123')).toBe(true);
      expect(gateway['clientSubscriptions'].has('socket-456')).toBe(true);
    });
  });
});
