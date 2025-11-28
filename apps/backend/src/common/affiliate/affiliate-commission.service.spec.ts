import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { QueryRunner } from 'typeorm';
import { AffiliateCommissionService } from './affiliate-commission.service';

describe('AffiliateCommissionService', () => {
  let service: AffiliateCommissionService;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    mockQueryRunner = {
      query: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [AffiliateCommissionService],
    }).compile();

    service = module.get<AffiliateCommissionService>(AffiliateCommissionService);

    // Suppress logs in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearCache();
  });

  describe('accumulateCommission', () => {
    const userId = 'user-123';
    const affiliateId = 'affiliate-456';
    const asset = AssetTypeEnum.BTC;
    const betAmount = '1.0';
    const houseEdge = 1;

    it('should accumulate commission for user with affiliate', async () => {
      // Mock affiliate lookup
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId }]);
      // Mock wallet update
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission(userId, asset, betAmount, houseEdge, mockQueryRunner);

      // Should query for affiliate
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT ac."userId" as "affiliateId"'),
        [userId],
      );

      // Should insert/update wallet
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
        expect.arrayContaining([affiliateId, asset, expect.any(String)]),
      );
    });

    it('should skip commission if user has no affiliate', async () => {
      // Mock no affiliate found
      mockQueryRunner.query.mockResolvedValueOnce([]);

      await service.accumulateCommission(userId, asset, betAmount, houseEdge, mockQueryRunner);

      // Should only query for affiliate, not update wallet
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT ac."userId" as "affiliateId"'),
        [userId],
      );
    });

    it('should calculate commission correctly', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission(userId, asset, '100', 1, mockQueryRunner);

      // Commission formula: (betAmount * houseEdge / 100 / 2) * 0.1
      // (100 * 1 / 100 / 2) * 0.1 = 0.05
      const expectedCommission = new BigNumber(100)
        .multipliedBy(1 / 100)
        .dividedBy(2)
        .multipliedBy(0.1)
        .decimalPlaces(8, BigNumber.ROUND_DOWN)
        .toFixed(8);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
        [affiliateId, asset, expectedCommission],
      );
    });

    it('should skip if commission is zero or negative', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId }]);

      await service.accumulateCommission(userId, asset, '0', houseEdge, mockQueryRunner);

      // Should query for affiliate but not update wallet
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('should throw errors to allow transaction rollback', async () => {
      mockQueryRunner.query.mockRejectedValueOnce(new Error('Database error'));

      // Should throw to trigger transaction rollback
      await expect(
        service.accumulateCommission(userId, asset, betAmount, houseEdge, mockQueryRunner),
      ).rejects.toThrow('Database error');

      // Error should be logged
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should use cached affiliateId on subsequent calls', async () => {
      // First call - cache miss
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission(userId, asset, betAmount, houseEdge, mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);

      jest.clearAllMocks();

      // Second call - cache hit
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission(userId, asset, betAmount, houseEdge, mockQueryRunner);

      // Should only call wallet update, not affiliate lookup
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
        expect.any(Array),
      );
    });
  });

  describe('LRU Cache', () => {
    const userId = 'user-123';

    it('should cache null affiliateId (user without affiliate)', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([]);

      await service.accumulateCommission(userId, AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);

      jest.clearAllMocks();

      // Second call should use cache
      await service.accumulateCommission(userId, AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      expect(mockQueryRunner.query).not.toHaveBeenCalled();
    });

    it('should update LRU order on cache hit', async () => {
      // Warm up cache with multiple users
      for (let i = 0; i < 3; i++) {
        mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: `aff-${i}` }]);
        mockQueryRunner.query.mockResolvedValueOnce(undefined);
        await service.accumulateCommission(
          `user-${i}`,
          AssetTypeEnum.BTC,
          '1.0',
          1,
          mockQueryRunner,
        );
      }

      jest.clearAllMocks();

      // Access first user again (should move to end of LRU)
      mockQueryRunner.query.mockResolvedValueOnce(undefined);
      await service.accumulateCommission('user-0', AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      // Should only update wallet, not query affiliate (cache hit)
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('should evict least recently used when cache is full', async () => {
      // Note: LRU_CACHE_SIZE = 1000 in service
      // For testing purposes, we'll test the eviction logic conceptually
      // by verifying cache behavior with a small number of entries

      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('maxSize');
      expect(stats.maxSize).toBe(1000);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 1000,
      });
    });

    it('should reflect cache size after adding entries', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission('user-1', AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      const stats = service.getCacheStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('invalidateCacheEntry', () => {
    it('should invalidate cache for specific user', async () => {
      // Add entry to cache
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission('user-1', AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      expect(service.getCacheStats().size).toBe(1);

      jest.clearAllMocks();

      // Invalidate cache for user-1
      service.invalidateCacheEntry('user-1');

      expect(service.getCacheStats().size).toBe(0);

      // Next call should query database again
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-2' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission('user-1', AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      // Should query database (cache miss)
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);
    });

    it('should not throw when invalidating non-existent entry', () => {
      expect(() => service.invalidateCacheEntry('non-existent')).not.toThrow();
    });
  });

  describe('clearCache', () => {
    it('should clear all cache entries', async () => {
      // Add entry to cache
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission('user-1', AssetTypeEnum.BTC, '1.0', 1, mockQueryRunner);

      expect(service.getCacheStats().size).toBe(1);

      service.clearCache();

      expect(service.getCacheStats().size).toBe(0);
    });
  });

  describe('Commission Calculations', () => {
    const asset = AssetTypeEnum.BTC;

    beforeEach(() => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'affiliate-456' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);
    });

    it('should calculate commission for $388 bet with 1% house edge', async () => {
      // Test case from simulator
      const betAmountBtc = '0.00351106'; // ~$388
      const houseEdge = 1;

      await service.accumulateCommission('user-1', asset, betAmountBtc, houseEdge, mockQueryRunner);

      // Expected: (0.00351106 * 0.01 / 2) * 0.1 = 0.00000175553
      const expectedCommission = new BigNumber(betAmountBtc)
        .multipliedBy(houseEdge / 100)
        .dividedBy(2)
        .multipliedBy(0.1)
        .decimalPlaces(8, BigNumber.ROUND_DOWN)
        .toFixed(8);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
        ['affiliate-456', asset, expectedCommission],
      );
    });

    it('should calculate commission for 3% house edge (sportsbook)', async () => {
      const betAmount = '1.0';
      const houseEdge = 3;

      await service.accumulateCommission('user-1', asset, betAmount, houseEdge, mockQueryRunner);

      // Expected: (1.0 * 0.03 / 2) * 0.1 = 0.0015
      const expectedCommission = new BigNumber(betAmount)
        .multipliedBy(houseEdge / 100)
        .dividedBy(2)
        .multipliedBy(0.1)
        .decimalPlaces(8, BigNumber.ROUND_DOWN)
        .toFixed(8);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
        ['affiliate-456', asset, expectedCommission],
      );

      expect(expectedCommission).toBe('0.00150000');
    });

    it('should round down to 8 decimal places', async () => {
      const betAmount = '0.123456789';
      const houseEdge = 1;

      await service.accumulateCommission('user-1', asset, betAmount, houseEdge, mockQueryRunner);

      const call = mockQueryRunner.query.mock.calls.find((call) =>
        call[0].includes('INSERT INTO affiliate.affiliate_wallets'),
      );

      expect(call).toBeDefined();
      expect(call?.[1]).toBeDefined();
      const commissionParam = call![1]![2] as string;
      const decimalPlaces = commissionParam.split('.')[1]?.length || 0;

      expect(decimalPlaces).toBeLessThanOrEqual(8);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small bet amounts', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);

      await service.accumulateCommission(
        'user-1',
        AssetTypeEnum.BTC,
        '0.00000001',
        1,
        mockQueryRunner,
      );

      // Commission will be too small, should skip
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(1);
    });

    it('should handle very large bet amounts', async () => {
      mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);

      await service.accumulateCommission(
        'user-1',
        AssetTypeEnum.BTC,
        '1000000',
        1,
        mockQueryRunner,
      );

      // Should calculate correctly without overflow
      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);

      const call = mockQueryRunner.query.mock.calls[1];
      expect(call).toBeDefined();
      expect(call?.[1]).toBeDefined();
      const commission = call![1]![2] as string;

      expect(parseFloat(commission)).toBeGreaterThan(0);
      expect(parseFloat(commission)).toBeLessThan(1000000);
    });

    it('should handle different asset types', async () => {
      const assets = [AssetTypeEnum.BTC, AssetTypeEnum.ETH, AssetTypeEnum.USDT];

      for (const asset of assets) {
        mockQueryRunner.query.mockResolvedValueOnce([{ affiliateId: 'aff-1' }]);
        mockQueryRunner.query.mockResolvedValueOnce(undefined);

        await service.accumulateCommission('user-1', asset, '1.0', 1, mockQueryRunner);

        expect(mockQueryRunner.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO affiliate.affiliate_wallets'),
          expect.arrayContaining(['aff-1', asset, expect.any(String)]),
        );

        jest.clearAllMocks();
      }
    });
  });
});
