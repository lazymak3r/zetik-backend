import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AssetTypeEnum, RakebackEntity } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { RakebackService } from './rakeback.service';
import { UserVipStatusService } from './user-vip-status.service';
import { VipTierService } from './vip-tier.service';

describe('RakebackService', () => {
  let service: RakebackService;
  let rakebackRepoMock: jest.Mocked<Repository<RakebackEntity>>;
  let vipStatusServiceMock: jest.Mocked<UserVipStatusService>;
  let vipTierServiceMock: jest.Mocked<VipTierService>;
  let balanceServiceMock: jest.Mocked<BalanceService>;
  let distributedLockServiceMock: jest.Mocked<DistributedLockService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RakebackService,
        {
          provide: getRepositoryToken(RakebackEntity),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: UserVipStatusService,
          useValue: {
            getUserVipStatus: jest.fn(),
          },
        },
        {
          provide: VipTierService,
          useValue: {
            findTierByLevel: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            updateBalance: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                findOne: jest.fn(),
                save: jest.fn(),
              },
            }),
          },
        },
        {
          provide: DistributedLockService,
          useValue: {
            withLock: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RakebackService>(RakebackService);
    rakebackRepoMock = module.get(getRepositoryToken(RakebackEntity));
    vipStatusServiceMock = module.get(UserVipStatusService);
    vipTierServiceMock = module.get(VipTierService);
    balanceServiceMock = module.get(BalanceService);
    distributedLockServiceMock = module.get(DistributedLockService);
  });

  describe('getRakebackAmount', () => {
    it('should return empty crypto object if no vip level', async () => {
      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'test',
        currentVipLevel: 0,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rakebackRepoMock.find.mockResolvedValue([]);

      const result = await service.getRakebackAmount('user1');
      expect(result).toEqual({ crypto: {} });
    });

    it('should calculate rakeback for multiple assets', async () => {
      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 1,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vipTierServiceMock.findTierByLevel.mockResolvedValue({
        level: 1,
        name: 'Bronze',
        isForVip: true,
        wagerRequirement: '1000',
        rakebackPercentage: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      rakebackRepoMock.find.mockResolvedValue([
        {
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '1.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'USDT',
          accumulatedHouseSideAmount: '10.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'ETH',
          accumulatedHouseSideAmount: '0',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.getRakebackAmount('user1');
      expect(result).toEqual({
        crypto: {
          BTC: '0.10000000',
          USDT: '1.00000000',
        },
      });
    });
  });

  describe('claimRakeback', () => {
    it('should claim successfully and reset amount for specific asset', async () => {
      const mockRakeback = {
        userId: 'user1',
        asset: 'BTC',
        accumulatedHouseSideAmount: '1.00000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 1,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vipTierServiceMock.findTierByLevel.mockResolvedValue({
        level: 1,
        name: 'Bronze',
        isForVip: true,
        wagerRequirement: '1000',
        rakebackPercentage: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      balanceServiceMock.updateBalance.mockResolvedValue({
        success: true,
        status: 'CONFIRMED' as any,
        balance: '100',
      });

      const queryRunnerMock = service['dataSource'].createQueryRunner();
      queryRunnerMock.manager.findOne = jest.fn().mockResolvedValue(mockRakeback);
      queryRunnerMock.manager.save = jest.fn().mockResolvedValue(mockRakeback);

      const result = await service.claimRakeback('user1', AssetTypeEnum.BTC);
      expect(result.success).toBe(true);
      expect(result.amount).toBe('0.10000000');
      expect(result.asset).toBe('BTC');
      expect(mockRakeback.accumulatedHouseSideAmount).toBe('0.00000000');
    });

    it('should fail if no accumulated amount for asset', async () => {
      const mockRakeback = {
        userId: 'user1',
        asset: 'BTC',
        accumulatedHouseSideAmount: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const queryRunnerMock = service['dataSource'].createQueryRunner();
      queryRunnerMock.manager.findOne = jest.fn().mockResolvedValue(mockRakeback);

      const result = await service.claimRakeback('user1', AssetTypeEnum.BTC);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No accumulated amount for rakeback calculation');
    });
  });

  describe('claimAllRakeback', () => {
    it('should return success false when no rakeback available', async () => {
      distributedLockServiceMock.withLock.mockImplementation(async (resource, ttl, callback) => {
        return callback();
      });

      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 0,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rakebackRepoMock.find.mockResolvedValue([]);

      const result = await service.claimAllRakeback('user1');

      expect(result).toEqual({
        success: false,
        totalAssets: 0,
        claimedCount: 0,
        failedCount: 0,
        claimedAssets: [],
        failedAssets: [],
      });
      expect(distributedLockServiceMock.withLock).toHaveBeenCalledWith(
        'bonus:rakeback:claim-all:user1',
        expect.any(Number),
        expect.any(Function),
        expect.any(Object),
      );
    });

    it('should claim all available assets successfully', async () => {
      distributedLockServiceMock.withLock.mockImplementation(async (resource, ttl, callback) => {
        return callback();
      });

      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 1,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vipTierServiceMock.findTierByLevel.mockResolvedValue({
        level: 1,
        name: 'Bronze',
        isForVip: true,
        wagerRequirement: '1000',
        rakebackPercentage: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      rakebackRepoMock.find.mockResolvedValue([
        {
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '1.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'USDT',
          accumulatedHouseSideAmount: '10.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      balanceServiceMock.updateBalance.mockResolvedValue({
        success: true,
        status: 'CONFIRMED' as any,
        balance: '100',
      });

      const queryRunnerMock = service['dataSource'].createQueryRunner();
      queryRunnerMock.manager.findOne = jest
        .fn()
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '1.00000000',
        })
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'USDT',
          accumulatedHouseSideAmount: '10.00000000',
        });
      queryRunnerMock.manager.save = jest.fn();

      const result = await service.claimAllRakeback('user1');

      expect(result).toEqual({
        success: true,
        totalAssets: 2,
        claimedCount: 2,
        failedCount: 0,
        claimedAssets: ['BTC', 'USDT'],
        failedAssets: [],
      });
    });

    it('should handle partial failures correctly', async () => {
      distributedLockServiceMock.withLock.mockImplementation(async (resource, ttl, callback) => {
        return callback();
      });

      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 1,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vipTierServiceMock.findTierByLevel.mockResolvedValue({
        level: 1,
        name: 'Bronze',
        isForVip: true,
        wagerRequirement: '1000',
        rakebackPercentage: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      rakebackRepoMock.find.mockResolvedValue([
        {
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '1.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'ETH',
          accumulatedHouseSideAmount: '0.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'USDT',
          accumulatedHouseSideAmount: '10.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      balanceServiceMock.updateBalance.mockResolvedValue({
        success: true,
        status: 'CONFIRMED' as any,
        balance: '100',
      });

      const queryRunnerMock = service['dataSource'].createQueryRunner();
      queryRunnerMock.manager.findOne = jest
        .fn()
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '1.00000000',
        })
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'ETH',
          accumulatedHouseSideAmount: '0.00000000',
        })
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'USDT',
          accumulatedHouseSideAmount: '10.00000000',
        });
      queryRunnerMock.manager.save = jest.fn();

      const result = await service.claimAllRakeback('user1');

      expect(result.success).toBe(true);
      expect(result.totalAssets).toBe(3);
      expect(result.claimedCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.claimedAssets).toEqual(['BTC', 'USDT']);
      expect(result.failedAssets).toHaveLength(1);
      expect(result.failedAssets[0].asset).toBe('ETH');
    });

    it('should return all failures when all claims fail', async () => {
      distributedLockServiceMock.withLock.mockImplementation(async (resource, ttl, callback) => {
        return callback();
      });

      vipStatusServiceMock.getUserVipStatus.mockResolvedValue({
        userId: 'user1',
        currentVipLevel: 1,
        currentWager: '0',
        currentBonusVipTier: null as any,
        previousVipLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vipTierServiceMock.findTierByLevel.mockResolvedValue({
        level: 1,
        name: 'Bronze',
        isForVip: true,
        wagerRequirement: '1000',
        rakebackPercentage: '10',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      rakebackRepoMock.find.mockResolvedValue([
        {
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '0.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          userId: 'user1',
          asset: 'ETH',
          accumulatedHouseSideAmount: '0.00000000',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const queryRunnerMock = service['dataSource'].createQueryRunner();
      queryRunnerMock.manager.findOne = jest
        .fn()
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'BTC',
          accumulatedHouseSideAmount: '0.00000000',
        })
        .mockResolvedValueOnce({
          userId: 'user1',
          asset: 'ETH',
          accumulatedHouseSideAmount: '0.00000000',
        });

      const result = await service.claimAllRakeback('user1');

      expect(result).toEqual({
        success: false,
        totalAssets: 2,
        claimedCount: 0,
        failedCount: 2,
        claimedAssets: [],
        failedAssets: [
          {
            asset: 'BTC',
            error: 'No accumulated amount for rakeback calculation',
          },
          {
            asset: 'ETH',
            error: 'No accumulated amount for rakeback calculation',
          },
        ],
      });
    });
  });
});
