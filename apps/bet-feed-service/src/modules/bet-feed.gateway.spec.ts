import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { BetFeedGateway } from './bet-feed.gateway';
import { BetFeedService, BetFeedTab, IBetFeedDelta, IBetFeedResponse } from './bet-feed.service';

// Mock AuthenticatedSocket - extended Socket with user info
interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: { id: string };
  handshake: Socket['handshake'] & {
    address: string;
  };
}

describe('BetFeedGateway', () => {
  let gateway: BetFeedGateway;
  let betFeedService: jest.Mocked<BetFeedService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mockSocket: jest.Mocked<AuthenticatedSocket>;
  let mockServer: jest.Mocked<Server>;

  const mockUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockDeltaData: IBetFeedDelta = {
    tab: BetFeedTab.ALL_BETS,
    newBets: [
      {
        id: 'bet-new-1',
        game: {
          name: 'DICE',
          iconName: 'dice-icon',
          imageName: 'dice-image',
        },
        user: {
          id: 'test-user-id',
          name: 'testuser',
          imageName: '/images/vip-bronze.png',
        },
        time: '2025-01-01T01:00:00.000Z',
        bet: '0.002',
        multiplier: '50.0',
        payout: '0.1',
        cryptoAsset: 'BTC',
        assetImagePath: 'btc',
      },
    ],
    count: 1,
    timestamp: '2025-01-01T01:00:00.000Z',
  };

  const mockFeedData: IBetFeedResponse = {
    bets: [
      {
        id: 'bet-1',
        game: {
          name: 'DICE',
          iconName: 'dice-icon',
          imageName: 'dice-image',
        },
        user: {
          id: 'test-user-id',
          name: 'testuser',
          imageName: '/images/vip-bronze.png',
        },
        time: '2025-01-01T00:00:00.000Z',
        bet: '0.001',
        multiplier: '30.0',
        payout: '0.03',
        cryptoAsset: 'BTC',
        assetImagePath: 'btc',
      },
    ],
    lastUpdate: '2025-01-01T00:00:00.000Z',
    tab: BetFeedTab.ALL_BETS,
    totalCount: 1,
  };

  beforeEach(async () => {
    const jwtServiceMock = {
      verify: jest.fn(),
    };

    const configServiceMock = {
      get: jest.fn(),
    };

    const betFeedServiceMock = {
      getCachedFeed: jest.fn(),
      getFeedByTab: jest.fn(),
      setSubscribersCount: jest.fn(),
    };

    const socketMock = {
      id: 'socket-123',
      userId: 'user-123',
      user: { id: 'user-123' },
      handshake: {
        address: '127.0.0.1',
        headers: {
          authorization: 'Bearer test-token',
        },
        auth: {},
        query: {},
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as jest.Mocked<AuthenticatedSocket>;

    const serverMock = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      allSockets: jest.fn().mockResolvedValue(new Set(['socket1', 'socket2'])),
    } as unknown as jest.Mocked<Server>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetFeedGateway,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: BetFeedService,
          useValue: betFeedServiceMock,
        },
      ],
    }).compile();

    gateway = module.get<BetFeedGateway>(BetFeedGateway);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    betFeedService = module.get(BetFeedService);
    mockSocket = socketMock;
    mockServer = serverMock;

    // Set up server reference
    gateway.server = mockServer;

    // Mock successful authentication by default
    configServiceMock.get.mockReturnValue('test-secret');
    jwtServiceMock.verify.mockReturnValue({ sub: 'user-123' });
    betFeedService.getCachedFeed.mockResolvedValue(mockFeedData);
    betFeedService.getFeedByTab.mockResolvedValue(mockFeedData);
  });

  describe('handleConnection', () => {
    it('should authenticate and accept valid connections', () => {
      gateway.handleConnection(mockSocket);

      expect(jwtService.verify).toHaveBeenCalledWith('test-token', { secret: 'test-secret' });
      expect(mockSocket.userId).toBe('user-123');
      expect(mockSocket.user).toEqual({ id: 'user-123' });
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        message: 'Successfully connected to bet feed',
        userId: 'user-123',
        timestamp: expect.any(Date),
      });
    });

    it('should reject unauthenticated connections (no token)', () => {
      const unauthSocket = {
        ...mockSocket,
        handshake: {
          ...mockSocket.handshake,
          headers: {},
          auth: {},
          query: {},
        },
      } as unknown as jest.Mocked<AuthenticatedSocket>;

      gateway.handleConnection(unauthSocket);

      expect(unauthSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required for bet feed access',
        code: 'UNAUTHORIZED',
      });
      expect(unauthSocket.disconnect).toHaveBeenCalled();
    });

    it('should reject invalid JWT tokens', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      gateway.handleConnection(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication required for bet feed access',
        code: 'UNAUTHORIZED',
      });
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up connected clients on disconnect', () => {
      // Set up connected client
      gateway['connectedClients'].set(mockSocket.id, mockUser.id);

      gateway.handleDisconnect(mockSocket);

      expect(gateway['connectedClients'].has(mockSocket.id)).toBe(false);
    });

    it('should handle disconnect for unknown clients gracefully', () => {
      expect(() => gateway.handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  describe('handleSubscribe', () => {
    beforeEach(() => {
      mockSocket.userId = mockUser.id;
    });

    it('should subscribe to ALL_BETS tab by default', async () => {
      await gateway.handleSubscribe(mockSocket, {});

      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:all-bets');
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribed', {
        message: 'Successfully subscribed to bet feed: all-bets',
        tab: BetFeedTab.ALL_BETS,
        timestamp: expect.any(Date),
      });
      expect(betFeedService.getFeedByTab).toHaveBeenCalledWith(BetFeedTab.ALL_BETS);
    });

    it('should subscribe to specific tab when provided', async () => {
      await gateway.handleSubscribe(mockSocket, { tab: BetFeedTab.LUCKY_WINNERS });

      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:lucky-winners');
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribed', {
        message: 'Successfully subscribed to bet feed: lucky-winners',
        tab: BetFeedTab.LUCKY_WINNERS,
        timestamp: expect.any(Date),
      });
      expect(betFeedService.getFeedByTab).toHaveBeenCalledWith(BetFeedTab.LUCKY_WINNERS);
    });

    it('should reject invalid tab names', async () => {
      await gateway.handleSubscribe(mockSocket, { tab: 'invalid-tab' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid tab: invalid-tab',
        code: 'INVALID_TAB',
      });
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should send initial feed data on subscription (delta system)', async () => {
      await gateway.handleSubscribe(mockSocket, { tab: BetFeedTab.ALL_BETS });

      // Should emit bet-feed-initial for delta system
      expect(mockSocket.emit).toHaveBeenCalledWith('bet-feed-initial', {
        type: 'initial',
        data: mockFeedData,
        timestamp: expect.any(Date),
      });

      // Should also emit old format for backward compatibility
      expect(mockSocket.emit).toHaveBeenCalledWith('bet-feed-update', {
        type: 'bet-feed-update',
        data: mockFeedData,
        timestamp: expect.any(Date),
      });
    });

    it('should handle tab switch with initial feed', async () => {
      // First subscription
      await gateway.handleSubscribe(mockSocket, { tab: BetFeedTab.ALL_BETS });

      // Clear previous calls
      mockSocket.emit.mockClear();
      mockSocket.join.mockClear();
      mockSocket.leave.mockClear();

      // Subscribe to same tab again - should leave and rejoin
      await gateway.handleSubscribe(mockSocket, { tab: BetFeedTab.ALL_BETS });

      expect(mockSocket.leave).toHaveBeenCalledWith('bet-feed:all-bets');
      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:all-bets');
      // Should still send initial feed data (delta system always sends initial on subscribe)
      expect(mockSocket.emit).toHaveBeenCalledWith('bet-feed-initial', expect.any(Object));
    });
  });

  describe('handleSwitchTab', () => {
    beforeEach(() => {
      mockSocket.userId = mockUser.id;
      (mockSocket as any).currentTab = BetFeedTab.ALL_BETS;
    });

    it('should switch from one tab to another', async () => {
      await gateway.handleSwitchTab(mockSocket, { tab: BetFeedTab.ZETIKS });

      expect(mockSocket.leave).toHaveBeenCalledWith('bet-feed:all-bets');
      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:zetiks');
      expect((mockSocket as any).currentTab).toBe(BetFeedTab.ZETIKS);
    });

    it('should send fresh data for new tab', async () => {
      const zetiksData = { ...mockFeedData, tab: BetFeedTab.ZETIKS };
      betFeedService.getFeedByTab.mockResolvedValue(zetiksData);

      await gateway.handleSwitchTab(mockSocket, { tab: BetFeedTab.ZETIKS });

      expect(betFeedService.getFeedByTab).toHaveBeenCalledWith(BetFeedTab.ZETIKS);
      expect(mockSocket.emit).toHaveBeenCalledWith('bet-feed-update', {
        type: 'bet-feed-update',
        data: zetiksData,
        timestamp: expect.any(Date),
      });
    });

    it('should reject invalid tab names', async () => {
      await gateway.handleSwitchTab(mockSocket, { tab: 'invalid-tab' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid tab: invalid-tab',
        code: 'INVALID_TAB',
      });
      expect(mockSocket.leave).not.toHaveBeenCalled();
      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    it('should handle tab switch when no current tab is set', async () => {
      delete (mockSocket as any).currentTab;

      await gateway.handleSwitchTab(mockSocket, { tab: BetFeedTab.LUCKY_WINNERS });

      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:lucky-winners');
      expect((mockSocket as any).currentTab).toBe(BetFeedTab.LUCKY_WINNERS);
    });

    it('should handle errors when fetching new tab data', async () => {
      betFeedService.getFeedByTab.mockRejectedValue(new Error('Database error'));

      await gateway.handleSwitchTab(mockSocket, { tab: BetFeedTab.ZETIKS });

      expect(mockSocket.join).toHaveBeenCalledWith('bet-feed:zetiks');
      // Should still switch tab even if data fetch fails
      expect((mockSocket as any).currentTab).toBe(BetFeedTab.ZETIKS);
    });
  });

  describe('validateTab', () => {
    it('should validate correct tab names', () => {
      expect(gateway['validateTab']('all-bets')).toBe(BetFeedTab.ALL_BETS);
      expect(gateway['validateTab']('lucky-winners')).toBe(BetFeedTab.LUCKY_WINNERS);
      expect(gateway['validateTab']('zetiks')).toBe(BetFeedTab.ZETIKS);
    });

    it('should reject invalid tab names', () => {
      expect(gateway['validateTab']('invalid')).toBeNull();
      expect(gateway['validateTab']('')).toBeNull();
      expect(gateway['validateTab'](undefined as any)).toBeNull();
      expect(gateway['validateTab'](null as any)).toBeNull();
    });
  });

  describe('getRoomName', () => {
    it('should generate correct room names for each tab', () => {
      expect(gateway['getRoomName'](BetFeedTab.ALL_BETS)).toBe('bet-feed:all-bets');
      expect(gateway['getRoomName'](BetFeedTab.LUCKY_WINNERS)).toBe('bet-feed:lucky-winners');
      expect(gateway['getRoomName'](BetFeedTab.ZETIKS)).toBe('bet-feed:zetiks');
    });
  });

  describe('handleBetFeedUpdate', () => {
    it('should broadcast updates to correct room (backward compatibility)', () => {
      const updateData = { ...mockFeedData, tab: BetFeedTab.LUCKY_WINNERS };

      gateway.handleBetFeedUpdate(updateData);

      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:lucky-winners');
      expect(mockServer.emit).toHaveBeenCalledWith('bet-feed-update', {
        type: 'bet-feed-update',
        data: updateData,
        timestamp: expect.any(Date),
      });
    });

    it('should handle updates for different tabs separately', () => {
      const allBetsData = { ...mockFeedData, tab: BetFeedTab.ALL_BETS };
      const zetiksData = { ...mockFeedData, tab: BetFeedTab.ZETIKS };

      gateway.handleBetFeedUpdate(allBetsData);
      gateway.handleBetFeedUpdate(zetiksData);

      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:all-bets');
      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:zetiks');
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleBetFeedDelta', () => {
    it('should broadcast delta updates to correct room', () => {
      const deltaData = { ...mockDeltaData, tab: BetFeedTab.LUCKY_WINNERS };

      gateway.handleBetFeedDelta(deltaData);

      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:lucky-winners');
      expect(mockServer.emit).toHaveBeenCalledWith('bet-feed-delta', {
        type: 'delta',
        data: {
          tab: deltaData.tab,
          newBets: deltaData.newBets,
          count: deltaData.count,
          timestamp: deltaData.timestamp,
        },
      });
    });

    it('should handle delta updates for different tabs separately', () => {
      const allBetsDelta = { ...mockDeltaData, tab: BetFeedTab.ALL_BETS };
      const zetiksDelta = { ...mockDeltaData, tab: BetFeedTab.ZETIKS };

      gateway.handleBetFeedDelta(allBetsDelta);
      gateway.handleBetFeedDelta(zetiksDelta);

      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:all-bets');
      expect(mockServer.to).toHaveBeenCalledWith('bet-feed:zetiks');
      expect(mockServer.emit).toHaveBeenCalledTimes(2);
    });

    it('should only broadcast new bets in delta updates', () => {
      gateway.handleBetFeedDelta(mockDeltaData);

      expect(mockServer.emit).toHaveBeenCalledWith('bet-feed-delta', {
        type: 'delta',
        data: expect.objectContaining({
          newBets: mockDeltaData.newBets,
          count: 1,
        }),
      });
    });
  });

  describe('updateSubscriberCount', () => {
    it('should update subscriber count in service', async () => {
      const socketsMock = { size: 5 };
      Object.defineProperty(mockServer, 'sockets', {
        value: socketsMock,
        writable: false,
      });

      await gateway['updateSubscriberCount']();

      expect(betFeedService.setSubscribersCount).toHaveBeenCalledWith(6);
    });
  });
});
