import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AffiliateCampaignEntity } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { AffiliateService } from './affiliate.service';

describe('AffiliateService', () => {
  let service: AffiliateService;

  const mockCampaign = {
    id: 'campaign-1',
    userId: 'user-1',
    code: 'TEST-CAMP-001',
    name: 'Test Campaign',
    description: 'Test Description',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockDataSource = {
    query: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCampaignRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: getRepositoryToken(AffiliateCampaignEntity),
          useValue: mockCampaignRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);

    jest.clearAllMocks();
    // Default mock for ConfigService in deleteCampaign tests
    mockConfigService.get.mockReturnValue(undefined);
  });

  describe('findAll', () => {
    it('should return paginated campaigns with default pagination', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCampaign]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([
          {
            campaignCode: 'TEST-CAMP-001',
            asset: 'BTC',
            referral_count: '5',
            total_earned: '1.5',
          },
        ]);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: expect.arrayContaining([
          expect.objectContaining({
            id: 'campaign-1',
            owner: expect.objectContaining({
              id: 'user-1',
              username: 'testuser',
            }),
            uniqueReferrals: 5,
            totalCommission: 0,
          }),
        ]),
        total: 2,
        page: 1,
        limit: 10,
      });
    });

    it('should filter campaigns by owner name', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCampaign]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([]);

      await service.findAll({ ownerName: 'testuser', page: 1, limit: 10 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :ownerName'),
        { ownerName: '%testuser%' },
      );
    });

    it('should filter campaigns by campaign code', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCampaign]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([]);

      await service.findAll({ campaignCode: 'TEST', page: 1, limit: 10 });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('ac.code ILIKE :campaignCode', {
        campaignCode: '%TEST%',
      });
    });

    it('should handle pagination correctly', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(25),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.findAll({ page: 2, limit: 10 });

      expect(queryBuilder.offset).toHaveBeenCalledWith(10);
      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
    });

    it('should calculate total commission from multiple assets', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockCampaign]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([
          {
            campaignCode: 'TEST-CAMP-001',
            asset: 'BTC',
            referral_count: '5',
            total_earned: '1.5',
          },
          {
            campaignCode: 'TEST-CAMP-001',
            asset: 'ETH',
            referral_count: '5',
            total_earned: '10',
          },
        ]);

      // Mock currency rates
      const ratesCacheSpy = jest.spyOn(service as any, 'getCurrencyRates');
      ratesCacheSpy.mockResolvedValue(
        new Map([
          ['BTC', 50000],
          ['ETH', 3000],
        ]),
      );

      const result = await service.findAll({});

      expect(result.data[0].totalCommission).toBe(1.5 * 50000 + 10 * 3000);
    });

    it('should handle empty results gracefully', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockCampaignRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.findAll({});

      expect(result).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });
  });

  describe('getCampaignDetails', () => {
    it('should return campaign details with owner and earnings', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([
          {
            referral_count: '10',
            asset: 'BTC',
            total_earned: '2.5',
          },
        ]);

      const ratesCacheSpy = jest.spyOn(service as any, 'getCurrencyRates');
      ratesCacheSpy.mockResolvedValue(new Map([['BTC', 50000]]));

      const result = await service.getCampaignDetails('campaign-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'campaign-1',
          code: 'TEST-CAMP-001',
          totalReferrals: 10,
          totalCommission: 2.5 * 50000,
          owner: expect.objectContaining({
            id: 'user-1',
            username: 'testuser',
          }),
        }),
      );
    });

    it('should return null when campaign not found', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(null);

      const result = await service.getCampaignDetails('non-existent');

      expect(result).toBeNull();
    });

    it('should handle campaign with no earnings', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([]);

      const ratesCacheSpy = jest.spyOn(service as any, 'getCurrencyRates');
      ratesCacheSpy.mockResolvedValue(new Map());

      const result = await service.getCampaignDetails('campaign-1');

      expect(result).toEqual(
        expect.objectContaining({
          totalCommission: 0,
          totalReferrals: 0,
        }),
      );
    });

    it('should handle multiple earning assets', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'user-1',
            username: 'testuser',
            email: 'test@example.com',
          },
        ])
        .mockResolvedValueOnce([
          {
            referral_count: '10',
            asset: 'BTC',
            total_earned: '1.5',
          },
          {
            referral_count: '10',
            asset: 'ETH',
            total_earned: '20',
          },
        ]);

      const ratesCacheSpy = jest.spyOn(service as any, 'getCurrencyRates');
      ratesCacheSpy.mockResolvedValue(
        new Map([
          ['BTC', 50000],
          ['ETH', 3000],
        ]),
      );

      const result = await service.getCampaignDetails('campaign-1');

      expect(result?.totalCommission).toBe(1.5 * 50000 + 20 * 3000);
    });

    it('should handle unknown owner gracefully', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);
      mockDataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          referral_count: '5',
          asset: 'BTC',
          total_earned: '1',
        },
      ]);

      const ratesCacheSpy = jest.spyOn(service as any, 'getCurrencyRates');
      ratesCacheSpy.mockResolvedValue(new Map([['BTC', 50000]]));

      const result = await service.getCampaignDetails('campaign-1');

      expect(result?.owner).toEqual({
        id: 'user-1',
        email: null,
        username: 'Unknown',
      });
    });
  });

  describe('getCampaignReferrals', () => {
    it('should return paginated referrals with earnings in USD', async () => {
      mockCampaignRepository.findOne.mockResolvedValue({
        code: 'TEST-CAMP-001',
      });
      mockDataSource.query.mockResolvedValue([
        {
          userId: 'referred-user-1',
          email: 'referred@example.com',
          username: 'referreduser',
          totalEarnedUsd: '500.50',
          total_count: 2,
        },
        {
          userId: 'referred-user-2',
          email: 'referred2@example.com',
          username: 'referreduser2',
          totalEarnedUsd: '250.25',
          total_count: 2,
        },
      ]);

      const result = await service.getCampaignReferrals('campaign-1', 1, 10);

      expect(result).toEqual(
        expect.objectContaining({
          referrals: expect.arrayContaining([
            expect.objectContaining({
              userId: 'referred-user-1',
              username: 'referreduser',
              totalEarnedUsd: 500.5,
            }),
          ]),
          pagination: expect.objectContaining({
            page: 1,
            limit: 10,
            total: 2,
            totalPages: 1,
          }),
        }),
      );
    });

    it('should return null when campaign not found', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(null);

      const result = await service.getCampaignReferrals('non-existent', 1, 10);

      expect(result).toBeNull();
    });

    it('should handle pagination correctly', async () => {
      mockCampaignRepository.findOne.mockResolvedValue({
        code: 'TEST-CAMP-001',
      });

      const referrals = Array.from({ length: 15 }, (_, i) => ({
        userId: `user-${i}`,
        email: `user${i}@example.com`,
        username: `user${i}`,
        totalEarnedUsd: (Math.random() * 1000).toString(),
        total_count: 15,
      }));

      mockDataSource.query.mockResolvedValue(referrals.slice(10, 15));

      const result = await service.getCampaignReferrals('campaign-1', 2, 10);

      expect(result?.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
      });
    });

    it('should handle campaign with no referrals', async () => {
      mockCampaignRepository.findOne.mockResolvedValue({
        code: 'TEST-CAMP-001',
      });
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.getCampaignReferrals('campaign-1', 1, 10);

      expect(result).toEqual(
        expect.objectContaining({
          referrals: [],
          pagination: expect.objectContaining({
            total: 0,
            totalPages: 0,
          }),
        }),
      );
    });

    it('should calculate total pages correctly', async () => {
      mockCampaignRepository.findOne.mockResolvedValue({
        code: 'TEST-CAMP-001',
      });

      const referrals = Array.from({ length: 25 }, (_, i) => ({
        userId: `user-${i}`,
        email: `user${i}@example.com`,
        username: `user${i}`,
        totalEarnedUsd: '100',
        total_count: 25,
      }));

      mockDataSource.query.mockResolvedValue(referrals.slice(0, 10));

      const result = await service.getCampaignReferrals('campaign-1', 1, 10);

      expect(result?.pagination.totalPages).toBe(3);
    });
  });

  describe('deleteCampaign', () => {
    it.skip('should successfully delete campaign with no referrals - calls backend API', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
      };
      mockDataSource.createQueryBuilder.mockReturnValue(queryBuilder);
      mockCampaignRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCampaign('campaign-1');

      expect(result).toEqual({
        success: true,
        message: 'Campaign deleted successfully',
        campaign: mockCampaign,
      });
      expect(mockCampaignRepository.delete).toHaveBeenCalledWith('campaign-1');
    });

    it.skip('should prevent deletion of campaign with existing referrals', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '5' }),
      };
      mockDataSource.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.deleteCampaign('campaign-1');

      expect(result).toEqual({
        success: false,
        message: 'Cannot delete campaign with 5 existing referrals',
      });
      expect(mockCampaignRepository.delete).not.toHaveBeenCalled();
    });

    it.skip('should return error when campaign not found', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(null);

      const result = await service.deleteCampaign('non-existent');

      expect(result).toEqual({
        success: false,
        message: 'Campaign not found',
      });
    });

    it.skip('should handle single referral message', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: '1' }),
      };
      mockDataSource.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.deleteCampaign('campaign-1');

      expect(result.message).toContain('1 existing referrals');
    });

    it.skip('should handle null referral count as 0', async () => {
      mockCampaignRepository.findOne.mockResolvedValue(mockCampaign);

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: null }),
      };
      mockDataSource.createQueryBuilder.mockReturnValue(queryBuilder);
      mockCampaignRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCampaign('campaign-1');

      expect(result.success).toBe(true);
    });
  });

  describe('Currency rate caching', () => {
    it('should atomically update cache with new rates', async () => {
      mockDataSource.query.mockResolvedValue([
        { asset: 'BTC', rate: '50000' },
        { asset: 'ETH', rate: '3000' },
      ]);

      await (service as any).getCurrencyRates(['BTC', 'ETH']);

      // Verify cache was atomically replaced (new Map instance)
      expect((service as any).ratesCache.get('BTC')).toBe(50000);
      expect((service as any).ratesCache.get('ETH')).toBe(3000);
      expect((service as any).ratesCacheExpiry).toBeGreaterThan(Date.now());
    });

    it('should merge new rates into existing cache atomically', async () => {
      // Pre-populate cache with one asset
      (service as any).ratesCache.set('BTC', 40000);
      (service as any).ratesCacheExpiry = Date.now() + 5 * 60 * 1000;

      mockDataSource.query.mockResolvedValue([{ asset: 'ETH', rate: '3000' }]);

      await (service as any).getCurrencyRates(['ETH']);

      // Both old and new rates should exist
      expect((service as any).ratesCache.get('BTC')).toBe(40000);
      expect((service as any).ratesCache.get('ETH')).toBe(3000);
    });

    it('should respect cache TTL', async () => {
      mockDataSource.query.mockResolvedValue([{ asset: 'BTC', rate: '55000' }]);

      // Set cache with past expiry to trigger a refresh
      (service as any).ratesCacheExpiry = Date.now() - 1; // Already expired

      await (service as any).getCurrencyRates(['BTC']);

      expect(mockDataSource.query).toHaveBeenCalled();
    });

    it('should handle query errors gracefully and not update cache', async () => {
      mockDataSource.query.mockRejectedValue(new Error('Database error'));

      const result = await (service as any).getCurrencyRates(['BTC']);

      expect(result).toEqual(new Map());
    });

    it('should cache rates for subsequent calls within TTL', async () => {
      mockDataSource.query.mockResolvedValue([{ asset: 'BTC', rate: '50000' }]);

      await (service as any).getCurrencyRates(['BTC']);
      const callCount = mockDataSource.query.mock.calls.length;

      // Second call should use cache
      await (service as any).getCurrencyRates(['BTC']);

      expect(mockDataSource.query).toHaveBeenCalledTimes(callCount);
    });
  });
});
