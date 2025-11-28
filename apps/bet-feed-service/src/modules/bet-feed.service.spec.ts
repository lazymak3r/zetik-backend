import { GameTypeEnum, UserBetEntity } from '@zetik/shared-entities';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { BetFeedService, BetFeedTab } from './bet-feed.service';

describe('BetFeedService - Event-Driven Architecture', () => {
  let service: BetFeedService;
  let redisService: Redis;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let dataSource: jest.Mocked<DataSource>;

  const mockBetData = [
    {
      game: 'dice',
      gameName: 'Dice',
      betId: 'test-bet-1',
      userId: 'user-1',
      betAmount: '0.001',
      asset: 'BTC',
      multiplier: '30.0',
      payout: '0.03',
      betAmountUsd: '50.0',
      payoutUsd: '1500.0',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: new Date('2025-01-01T00:00:00Z'),
      user_id: 'user-1',
      user_username: 'testuser',
      user_displayName: 'Test User',
      user_avatarUrl: null,
      user_isPrivate: false,
    },
    {
      game: 'dice',
      gameName: 'Dice',
      betId: 'test-bet-2',
      userId: 'user-2',
      betAmount: '0.0001',
      asset: 'BTC',
      multiplier: '2.0',
      payout: '0.0002',
      betAmountUsd: '5.0',
      payoutUsd: '10.0',
      createdAt: new Date('2025-01-01T00:01:00Z'),
      updatedAt: new Date('2025-01-01T00:01:00Z'),
      user_id: 'user-2',
      user_username: 'testuser2',
      user_displayName: 'Test User 2',
      user_avatarUrl: null,
      user_isPrivate: false,
    },
  ];

  const mockVipStatus = [
    {
      userId: 'user-1',
      vipLevel: 1,
      vipLevelImage: '/images/vip-bronze.png',
    },
    {
      userId: 'user-2',
      vipLevel: 2,
      vipLevelImage: '/images/vip-silver.png',
    },
  ];

  beforeEach(async () => {
    // Create real Redis client for integration testing
    redisService = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: 15, // Use separate database for tests
    });

    // Clear test database
    await redisService.flushdb();

    const eventEmitterMock = {
      emit: jest.fn(),
    };

    const dataSourceMock = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetFeedService,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: redisService,
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitterMock,
        },
        {
          provide: DataSource,
          useValue: dataSourceMock,
        },
      ],
    }).compile();

    service = module.get<BetFeedService>(BetFeedService);
    eventEmitter = module.get(EventEmitter2);
    dataSource = module.get(DataSource);

    // Mock VIP status query
    dataSource.query.mockImplementation((query: string) => {
      if (query.includes('bonuses_user_vip_status')) {
        return Promise.resolve(mockVipStatus);
      }
      return Promise.resolve(mockBetData);
    });

    // Prevent automatic initialization
    service['isInitialized'] = false;
  });

  afterEach(async () => {
    await redisService.flushdb();
    await redisService.quit();
  });

  describe('Redis Cache Integration', () => {
    it('should initialize Redis cache on startup', async () => {
      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve(mockVipStatus);
        }
        return Promise.resolve(mockBetData);
      });

      await service['initializeRedisCache']();

      // Verify cache was populated for all tabs
      const allBets = await redisService.get('bet-feed:all-bets');
      const luckyWinners = await redisService.get('bet-feed:lucky-winners');
      const zetiks = await redisService.get('bet-feed:zetiks');

      expect(allBets).toBeDefined();
      expect(luckyWinners).toBeDefined();
      expect(zetiks).toBeDefined();

      const allBetsParsed = JSON.parse(allBets!);
      expect(allBetsParsed).toHaveLength(2);
    });

    it('should update Redis cache when new bet is added', async () => {
      await service['initializeRedisCache']();

      const newBet: UserBetEntity = {
        betId: 'test-bet-3',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.002',
        asset: 'BTC',
        multiplier: '50.0',
        payout: '0.1',
        betAmountUsd: '100.0',
        payoutUsd: '5000.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      // Mock user query for convertSingleBetToFeedItem
      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-1',
              username: 'testuser',
              displayName: 'Test User',
              avatarUrl: null,
              isPrivate: false,
            },
          ]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([mockVipStatus[0]]);
        }
        return Promise.resolve([]);
      });

      await service.handleBetCreated(newBet);

      // Verify cache was updated
      const allBets = await redisService.get('bet-feed:all-bets');
      const allBetsParsed = JSON.parse(allBets!);

      expect(allBetsParsed[0].id).toBe('test-bet-3');
      expect(allBetsParsed).toHaveLength(3); // 2 initial + 1 new
    });

    it('should trim cache to 50 items', async () => {
      // Populate with 51 bets
      const bets = Array.from({ length: 51 }, (_, i) => ({
        id: `bet-${i}`,
        game: { name: 'Dice', iconName: 'dice-icon', imageName: 'dice-image' },
        user: null,
        time: new Date().toISOString(),
        bet: '0.001',
        multiplier: '2.0',
        payout: '0.002',
        cryptoAsset: 'BTC',
        assetImagePath: 'btc',
      }));

      await redisService.setex('bet-feed:all-bets', 3600, JSON.stringify(bets));

      const newBet: UserBetEntity = {
        betId: 'bet-52',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '2.0',
        payout: '0.002',
        betAmountUsd: '50.0',
        payoutUsd: '100.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-1',
              username: 'testuser',
              displayName: 'Test User',
              isPrivate: false,
            },
          ]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([mockVipStatus[0]]);
        }
        return Promise.resolve([]);
      });

      await service.handleBetCreated(newBet);

      const allBets = await redisService.get('bet-feed:all-bets');
      const allBetsParsed = JSON.parse(allBets!);

      expect(allBetsParsed).toHaveLength(50);
      expect(allBetsParsed[0].id).toBe('bet-52');
    });

    it('should set 1 hour TTL on cache', async () => {
      await service['initializeRedisCache']();

      const ttl = await redisService.ttl('bet-feed:all-bets');
      expect(ttl).toBeGreaterThan(3500); // Should be close to 3600
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('Event-Driven Updates', () => {
    it('should handle user-bet.created event', async () => {
      await service['initializeRedisCache']();

      const newBet: UserBetEntity = {
        betId: 'event-bet-1',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '30.0',
        payout: '0.03',
        betAmountUsd: '50.0',
        payoutUsd: '1500.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-1',
              username: 'testuser',
              displayName: 'Test User',
              isPrivate: false,
            },
          ]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([mockVipStatus[0]]);
        }
        return Promise.resolve([]);
      });

      await service.handleBetCreated(newBet);

      // Verify Redis cache was updated
      const allBets = await redisService.get('bet-feed:all-bets');
      const allBetsParsed = JSON.parse(allBets!);
      expect(allBetsParsed[0].id).toBe('event-bet-1');

      // Verify WebSocket delta was broadcast
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'bet-feed.delta',
        expect.objectContaining({
          tab: BetFeedTab.ALL_BETS,
          newBets: expect.arrayContaining([
            expect.objectContaining({
              id: 'event-bet-1',
            }),
          ]),
          count: 1,
        }),
      );
    });

    it('should determine qualifying tabs correctly', () => {
      const regularBet: UserBetEntity = {
        multiplier: '2.0',
        payoutUsd: '10.0',
      } as UserBetEntity;

      const luckyBet: UserBetEntity = {
        multiplier: '30.0',
        payoutUsd: '100.0',
      } as UserBetEntity;

      const zetikBet: UserBetEntity = {
        multiplier: '10.0',
        payoutUsd: '2000.0',
      } as UserBetEntity;

      const bothBet: UserBetEntity = {
        multiplier: '50.0',
        payoutUsd: '5000.0',
      } as UserBetEntity;

      expect(service['determineQualifyingTabs'](regularBet)).toEqual([BetFeedTab.ALL_BETS]);
      expect(service['determineQualifyingTabs'](luckyBet)).toEqual([
        BetFeedTab.ALL_BETS,
        BetFeedTab.LUCKY_WINNERS,
      ]);
      expect(service['determineQualifyingTabs'](zetikBet)).toEqual([
        BetFeedTab.ALL_BETS,
        BetFeedTab.ZETIKS,
      ]);
      expect(service['determineQualifyingTabs'](bothBet)).toEqual([
        BetFeedTab.ALL_BETS,
        BetFeedTab.LUCKY_WINNERS,
        BetFeedTab.ZETIKS,
      ]);
    });

    it('should broadcast delta for all qualifying tabs', async () => {
      await service['initializeRedisCache']();

      const luckyZetikBet: UserBetEntity = {
        betId: 'lucky-zetik-bet',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.1',
        asset: 'BTC',
        multiplier: '50.0',
        payout: '5.0',
        betAmountUsd: '5000.0',
        payoutUsd: '250000.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-1',
              username: 'testuser',
              displayName: 'Test User',
              isPrivate: false,
            },
          ]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([mockVipStatus[0]]);
        }
        return Promise.resolve([]);
      });

      await service.handleBetCreated(luckyZetikBet);

      // Should be cached in all three tabs
      const allBets = await redisService.get('bet-feed:all-bets');
      const luckyWinners = await redisService.get('bet-feed:lucky-winners');
      const zetiks = await redisService.get('bet-feed:zetiks');

      expect(JSON.parse(allBets!)[0].id).toBe('lucky-zetik-bet');
      expect(JSON.parse(luckyWinners!)[0].id).toBe('lucky-zetik-bet');
      expect(JSON.parse(zetiks!)[0].id).toBe('lucky-zetik-bet');

      // Should emit delta for all three tabs
      expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
    });

    it('should handle private users correctly', async () => {
      const privateBet: UserBetEntity = {
        betId: 'private-bet',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-private',
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '2.0',
        payout: '0.002',
        betAmountUsd: '50.0',
        payoutUsd: '100.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-private',
              username: 'privateuser',
              displayName: 'Private User',
              isPrivate: true,
            },
          ]);
        }
        return Promise.resolve([]);
      });

      await service.handleBetCreated(privateBet);

      const allBets = await redisService.get('bet-feed:all-bets');
      const feedItem = JSON.parse(allBets!)[0];

      expect(feedItem.user).toBeNull();
    });
  });

  describe('Fallback Cron Job', () => {
    it('should update cache via cron as fallback', async () => {
      service['isInitialized'] = true;
      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve(mockVipStatus);
        }
        return Promise.resolve(mockBetData);
      });

      await service.updateBetFeed();

      // Verify metrics updated
      const metrics = service.getMetrics();
      expect(metrics.totalUpdates).toBe(1);
      expect(metrics.successfulUpdates).toBe(1);
    });

    it('should not run cron before initialization', async () => {
      service['isInitialized'] = false;

      await service.updateBetFeed();

      expect(dataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully', async () => {
      const badRedis = new Redis({
        host: 'nonexistent-host',
        port: 9999,
        retryStrategy: () => null, // Don't retry
        lazyConnect: true,
      });

      // Replace Redis service with bad instance
      service['redisService'] = badRedis;

      const newBet: UserBetEntity = {
        betId: 'error-bet',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '2.0',
        payout: '0.002',
        betAmountUsd: '50.0',
        payoutUsd: '100.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      // Should not throw
      await expect(service.handleBetCreated(newBet)).resolves.not.toThrow();

      await badRedis.quit();
    });

    it('should continue processing other events after error', async () => {
      dataSource.query.mockRejectedValueOnce(new Error('Database error'));

      const bet1: UserBetEntity = {
        betId: 'bet-1',
        game: GameTypeEnum.DICE,
        userId: 'user-1',
        multiplier: '2.0',
        payoutUsd: '100.0',
      } as UserBetEntity;

      const bet2: UserBetEntity = {
        betId: 'bet-2',
        game: GameTypeEnum.DICE,
        userId: 'user-2',
        multiplier: '2.0',
        payoutUsd: '100.0',
      } as UserBetEntity;

      await service.handleBetCreated(bet1);

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([{ id: 'user-2', isPrivate: false }]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      });

      // Second bet should process successfully
      await expect(service.handleBetCreated(bet2)).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should process bet event in under 50ms', async () => {
      await service['initializeRedisCache']();

      const newBet: UserBetEntity = {
        betId: 'perf-bet',
        game: GameTypeEnum.DICE,
        gameName: 'Dice',
        userId: 'user-1',
        betAmount: '0.001',
        asset: 'BTC',
        multiplier: '2.0',
        payout: '0.002',
        betAmountUsd: '50.0',
        payoutUsd: '100.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as UserBetEntity;

      dataSource.query.mockImplementation((query: string) => {
        if (query.includes('users.users')) {
          return Promise.resolve([
            {
              id: 'user-1',
              username: 'testuser',
              isPrivate: false,
            },
          ]);
        }
        if (query.includes('bonuses_user_vip_status')) {
          return Promise.resolve([mockVipStatus[0]]);
        }
        return Promise.resolve([]);
      });

      const start = Date.now();
      await service.handleBetCreated(newBet);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
