import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BetFeedTab, GameTypeEnum, IBetFeedItem } from '@zetik/common';
import { RedisService } from '../../common/services/redis.service';
import { BetFeedController } from './bet-feed.controller';

describe('BetFeedController', () => {
  let controller: BetFeedController;
  let redisService: RedisService;

  const mockRedisService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BetFeedController],
      providers: [
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<BetFeedController>(BetFeedController);
    redisService = module.get<RedisService>(RedisService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInitialFeed', () => {
    const mockBetFeedItem: IBetFeedItem = {
      id: 'bet_123456',
      game: {
        name: 'Dice',
        iconName: 'dice-icon',
        imageName: 'dice-image',
        gameType: GameTypeEnum.DICE,
      },
      user: {
        id: 'user_123',
        name: 'Player1',
        imageName: 'vip-gold.png',
      },
      time: '2025-10-10T12:00:00.000Z',
      bet: '10.5',
      multiplier: '2.5',
      payout: '26.25',
      cryptoAsset: 'USDT',
      assetImagePath: 'usdt',
    };

    describe('Valid Tabs', () => {
      it('should return cached data for all-bets tab', async () => {
        const mockBets = [mockBetFeedItem];
        mockRedisService.get.mockResolvedValue(JSON.stringify(mockBets));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(redisService.get).toHaveBeenCalledWith('bet-feed:all-bets');
        expect(result.bets).toEqual(mockBets);
        expect(result.tab).toBe(BetFeedTab.ALL_BETS);
        expect(result.totalCount).toBe(1);
        expect(result.lastUpdate).toBeDefined();
      });

      it('should return cached data for lucky-winners tab', async () => {
        const mockBets = [{ ...mockBetFeedItem, multiplier: '50.0' }];
        mockRedisService.get.mockResolvedValue(JSON.stringify(mockBets));

        const result = await controller.getInitialFeed(BetFeedTab.LUCKY_WINNERS);

        expect(redisService.get).toHaveBeenCalledWith('bet-feed:lucky-winners');
        expect(result.bets).toEqual(mockBets);
        expect(result.tab).toBe(BetFeedTab.LUCKY_WINNERS);
        expect(result.totalCount).toBe(1);
      });

      it('should return cached data for zetiks tab', async () => {
        const mockBets = [{ ...mockBetFeedItem, payout: '1500.0' }];
        mockRedisService.get.mockResolvedValue(JSON.stringify(mockBets));

        const result = await controller.getInitialFeed(BetFeedTab.ZETIKS);

        expect(redisService.get).toHaveBeenCalledWith('bet-feed:zetiks');
        expect(result.bets).toEqual(mockBets);
        expect(result.tab).toBe(BetFeedTab.ZETIKS);
        expect(result.totalCount).toBe(1);
      });

      it('should return multiple bets in correct format', async () => {
        const mockBets = [
          mockBetFeedItem,
          { ...mockBetFeedItem, id: 'bet_789', bet: '5.0' },
          { ...mockBetFeedItem, id: 'bet_101', bet: '15.0' },
        ];
        mockRedisService.get.mockResolvedValue(JSON.stringify(mockBets));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toHaveLength(3);
        expect(result.totalCount).toBe(3);
        expect(result.bets[0].id).toBe('bet_123456');
        expect(result.bets[1].id).toBe('bet_789');
        expect(result.bets[2].id).toBe('bet_101');
      });
    });

    describe('Cache Miss', () => {
      it('should return empty array when cache is empty', async () => {
        mockRedisService.get.mockResolvedValue(null);

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(redisService.get).toHaveBeenCalledWith('bet-feed:all-bets');
        expect(result.bets).toEqual([]);
        expect(result.tab).toBe(BetFeedTab.ALL_BETS);
        expect(result.totalCount).toBe(0);
        expect(result.lastUpdate).toBeDefined();
      });

      it('should return empty array when cache value is undefined', async () => {
        mockRedisService.get.mockResolvedValue(undefined);

        const result = await controller.getInitialFeed(BetFeedTab.LUCKY_WINNERS);

        expect(result.bets).toEqual([]);
        expect(result.totalCount).toBe(0);
      });
    });

    describe('Invalid Tab Parameter', () => {
      it('should throw BadRequestException for invalid tab', async () => {
        await expect(controller.getInitialFeed('invalid-tab')).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException with descriptive message', async () => {
        await expect(controller.getInitialFeed('wrong-tab')).rejects.toThrow(
          'Invalid tab: wrong-tab. Must be one of: all-bets, lucky-winners, zetiks',
        );
      });

      it('should throw BadRequestException for empty string', async () => {
        await expect(controller.getInitialFeed('')).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for uppercase tab', async () => {
        await expect(controller.getInitialFeed('ALL-BETS')).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException for partial match', async () => {
        await expect(controller.getInitialFeed('all-bet')).rejects.toThrow(BadRequestException);
      });
    });

    describe('Error Handling', () => {
      it('should return empty feed when Redis throws error', async () => {
        mockRedisService.get.mockRejectedValue(new Error('Redis connection failed'));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toEqual([]);
        expect(result.totalCount).toBe(0);
        expect(result.tab).toBe(BetFeedTab.ALL_BETS);
      });

      it('should return empty feed when JSON parse fails', async () => {
        mockRedisService.get.mockResolvedValue('invalid json');

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toEqual([]);
        expect(result.totalCount).toBe(0);
      });

      it('should handle Redis timeout gracefully', async () => {
        mockRedisService.get.mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100)),
        );

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toEqual([]);
        expect(result.totalCount).toBe(0);
      });
    });

    describe('Response Format', () => {
      it('should return correct response structure', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([mockBetFeedItem]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result).toHaveProperty('bets');
        expect(result).toHaveProperty('lastUpdate');
        expect(result).toHaveProperty('tab');
        expect(result).toHaveProperty('totalCount');
      });

      it('should return ISO timestamp for lastUpdate', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should preserve bet item structure from cache', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([mockBetFeedItem]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        const bet = result.bets[0];
        expect(bet).toHaveProperty('id');
        expect(bet).toHaveProperty('game');
        expect(bet).toHaveProperty('user');
        expect(bet).toHaveProperty('time');
        expect(bet).toHaveProperty('bet');
        expect(bet).toHaveProperty('multiplier');
        expect(bet).toHaveProperty('payout');
        expect(bet).toHaveProperty('cryptoAsset');
        expect(bet).toHaveProperty('assetImagePath');
      });

      it('should handle private user (null user)', async () => {
        const privateBet: IBetFeedItem = {
          ...mockBetFeedItem,
          user: null,
        };
        mockRedisService.get.mockResolvedValue(JSON.stringify([privateBet]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets[0].user).toBeNull();
      });
    });

    describe('Performance', () => {
      it('should call Redis get only once per request', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([mockBetFeedItem]));

        await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(redisService.get).toHaveBeenCalledTimes(1);
      });

      it('should not query database (Redis only)', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([]));

        await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        // Only Redis service should be called
        expect(redisService.get).toHaveBeenCalled();
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty array in cache', async () => {
        mockRedisService.get.mockResolvedValue(JSON.stringify([]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toEqual([]);
        expect(result.totalCount).toBe(0);
      });

      it('should handle large bet arrays (50 bets)', async () => {
        const largeBetArray = Array.from({ length: 50 }, (_, i) => ({
          ...mockBetFeedItem,
          id: `bet_${i}`,
        }));
        mockRedisService.get.mockResolvedValue(JSON.stringify(largeBetArray));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets).toHaveLength(50);
        expect(result.totalCount).toBe(50);
      });

      it('should handle special characters in bet data', async () => {
        const specialBet: IBetFeedItem = {
          ...mockBetFeedItem,
          user: {
            id: 'user_123',
            name: 'Player™®©',
            imageName: 'vip-gold.png',
          },
        };
        mockRedisService.get.mockResolvedValue(JSON.stringify([specialBet]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets[0].user?.name).toBe('Player™®©');
      });

      it('should handle very large numbers as strings', async () => {
        const bigBet: IBetFeedItem = {
          ...mockBetFeedItem,
          bet: '999999999999.999999',
          payout: '9999999999999.999999',
        };
        mockRedisService.get.mockResolvedValue(JSON.stringify([bigBet]));

        const result = await controller.getInitialFeed(BetFeedTab.ALL_BETS);

        expect(result.bets[0].bet).toBe('999999999999.999999');
        expect(result.bets[0].payout).toBe('9999999999999.999999');
      });
    });
  });
});
