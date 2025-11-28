import { Test, TestingModule } from '@nestjs/testing';
import { BonusJobTypeEnum, BonusVipTierEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import { Job } from 'bullmq';

import { BalanceService } from '../../../balance/balance.service';
import { RedisService } from '../../../common/services/redis.service';

import { IBonusJobData } from '../../interfaces/bonus-job-data.interface';
import { IVipTier } from '../../interfaces/vip-entities.interface';

import { createTestProviders } from '../../../test-utils';
import { BonusCalculationProcessor } from '../bonus-calculation.processor';
import { BonusNotificationService } from '../bonus-notification.service';
import { UserVipStatusService } from '../user-vip-status.service';
import { VipTierService } from '../vip-tier.service';

describe('BonusCalculationProcessor', () => {
  let processor: BonusCalculationProcessor;
  let userVipStatusService: jest.Mocked<UserVipStatusService>;
  let vipTierService: jest.Mocked<VipTierService>;
  let balanceService: jest.Mocked<BalanceService>;

  const mockUserStatus: UserVipStatusEntity = {
    userId: 'test-user-1',
    currentWager: '1000.00',
    currentVipLevel: 1,
    previousVipLevel: 0,
    currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVipTier: IVipTier = {
    level: 1,
    name: 'Bronze',
    wagerRequirement: '100000.00',
    weeklyBonusPercentage: '0.50',
    monthlyBonusPercentage: '2.00',
    rakebackPercentage: '5.00',
    isForVip: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJobData: IBonusJobData = {
    type: BonusJobTypeEnum.DAILY_BONUS,
    period: {
      from: new Date('2024-01-01'),
      to: new Date('2024-01-02'),
    },
    metadata: {
      scheduledAt: new Date(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonusCalculationProcessor,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: UserVipStatusService,
          useValue: {
            findAllUserVipStatus: jest.fn(),
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
            getBalanceStatisticsForUsers: jest.fn(),
            getDailyRakebackStats: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: RedisService,
          useValue: {
            setNX: jest.fn().mockResolvedValue(true),
            del: jest.fn(),
          },
        },
        {
          provide: 'BonusTransactionEntityRepository',
          useValue: {
            update: jest.fn().mockResolvedValue({ affected: 5 }),
            save: jest.fn(),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockReturnValue({}),
          },
        },
        {
          provide: BonusNotificationService,
          useValue: {
            createBonusNotification: jest.fn().mockResolvedValue({}),
            notifyBonusAwarded: jest.fn(),
            notifyBonusExpired: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<BonusCalculationProcessor>(BonusCalculationProcessor);
    userVipStatusService = module.get(UserVipStatusService);
    vipTierService = module.get(VipTierService);
    balanceService = module.get(BalanceService);
  });

  describe('process', () => {
    it('should handle daily bonus scheduler job', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'scheduleDailyBonuses',
        data: mockJobData,
      } as unknown as Job<IBonusJobData>;

      userVipStatusService.findAllUserVipStatus.mockResolvedValue([mockUserStatus]);
      vipTierService.findTierByLevel.mockResolvedValue(mockVipTier);
      balanceService.getBalanceStatisticsForUsers.mockResolvedValue([
        {
          userId: 'test-user-1',
          deps: '0',
          withs: '0',
          bets: '10000',
          refunds: '1000',
          wins: '5000',
          betCount: 100,
          winCount: 45,
        },
      ]);

      const result = await processor.process(mockJob);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.totalBonus).toBe('0');
    });

    it('should handle monthly bonus scheduler job', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'scheduleMonthlyBonuses',
        data: mockJobData,
      } as unknown as Job<IBonusJobData>;

      userVipStatusService.findAllUserVipStatus.mockResolvedValue([mockUserStatus]);
      vipTierService.findTierByLevel.mockResolvedValue(mockVipTier);
      balanceService.getBalanceStatisticsForUsers.mockResolvedValue([]);

      const result = await processor.process(mockJob);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.totalBonus).toBe('0');
    });

    it('should handle bonus expiration scheduler job', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'expireBonuses',
        data: mockJobData,
      } as unknown as Job<IBonusJobData>;

      // Mock the repository for expireBonuses
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      (processor as any).bonusTransactionRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      const result = await processor.process(mockJob);

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.totalBonus).toBe('0');
    });

    it('should throw error for unknown job type', async () => {
      const mockJob = {
        id: 'job-1',
        name: 'unknown.type',
        data: mockJobData,
      } as unknown as Job<IBonusJobData>;

      await expect(processor.process(mockJob)).rejects.toThrow('Unknown job type: unknown.type');
    });
  });

  describe('expireBonuses method', () => {
    it('should only expire bonuses where expiredAt has passed', async () => {
      const now = new Date('2025-10-05T04:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(now);

      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      (processor as any).bonusTransactionRepository = mockRepository;

      await processor.expireBonuses();

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status = :status', {
        status: 'PENDING',
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('expiredAt IS NOT NULL');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('expiredAt <= :now', { now });

      jest.useRealTimers();
    });
  });

  describe('expiredAt logic', () => {
    let mockBonusTransactionRepository: any;

    beforeEach(() => {
      mockBonusTransactionRepository = {
        create: jest.fn().mockReturnValue({}),
        save: jest.fn().mockResolvedValue({}),
        findOne: jest.fn().mockResolvedValue(null),
      };

      // Override the repository mock for these tests
      (processor as any).bonusTransactionRepository = mockBonusTransactionRepository;
    });

    it('should set expiredAt to next Monday for WEEKLY_AWARD from Friday', async () => {
      // Mock current date to Friday (2024-01-05)
      const mockFriday = new Date('2024-01-05T10:00:00Z'); // Friday
      jest.useFakeTimers();
      jest.setSystemTime(mockFriday);

      await (processor as any).awardBonus('user-1', '1000', 'WEEKLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '1000',
          bonusType: 'WEEKLY_AWARD',
          expiredAt: new Date('2024-01-08T00:00:00.000Z'), // Next Monday (3 days later)
        }),
      );

      jest.useRealTimers();
    });

    it('should set expiredAt to next Monday for WEEKLY_AWARD from Sunday', async () => {
      // Mock current date to Sunday (2024-01-07)
      const mockSunday = new Date('2024-01-07T10:00:00Z'); // Sunday
      jest.useFakeTimers();
      jest.setSystemTime(mockSunday);

      await (processor as any).awardBonus('user-1', '1000', 'WEEKLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '1000',
          bonusType: 'WEEKLY_AWARD',
          expiredAt: new Date('2024-01-08T00:00:00.000Z'), // Next Monday (1 day later)
        }),
      );

      jest.useRealTimers();
    });

    it('should set expiredAt to next Monday for WEEKLY_AWARD from Monday', async () => {
      // Mock current date to Monday (2024-01-01)
      const mockMonday = new Date('2024-01-01T10:00:00Z'); // Monday
      jest.useFakeTimers();
      jest.setSystemTime(mockMonday);

      await (processor as any).awardBonus('user-1', '1000', 'WEEKLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '1000',
          bonusType: 'WEEKLY_AWARD',
          expiredAt: new Date('2024-01-08T00:00:00.000Z'), // Next Monday (7 days later)
        }),
      );

      jest.useRealTimers();
    });

    it('should set expiredAt to first day of next month for MONTHLY_AWARD', async () => {
      // Mock current date to mid-January (2024-01-15)
      const mockMidJanuary = new Date('2024-01-15T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockMidJanuary);

      await (processor as any).awardBonus('user-1', '2000', 'MONTHLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '2000',
          bonusType: 'MONTHLY_AWARD',
          expiredAt: new Date('2024-02-01T00:00:00.000Z'), // First day of February (next month)
        }),
      );

      jest.useRealTimers();
    });

    it('should set expiredAt to first day of next month for MONTHLY_AWARD at month end', async () => {
      // Mock current date to end of January (2024-01-31)
      const mockEndJanuary = new Date('2024-01-31T23:30:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockEndJanuary);

      await (processor as any).awardBonus('user-1', '2000', 'MONTHLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '2000',
          bonusType: 'MONTHLY_AWARD',
          expiredAt: new Date('2024-02-01T00:00:00.000Z'), // First day of February (next month)
        }),
      );

      jest.useRealTimers();
    });

    it('should set expiredAt to 2 days for other bonus types (RAKEBACK)', async () => {
      // Mock current date to Monday (2024-01-01)
      const mockMonday = new Date('2024-01-01T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockMonday);

      await (processor as any).awardBonus('user-1', '500', 'RAKEBACK', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '500',
          bonusType: 'RAKEBACK',
          expiredAt: new Date('2024-01-03T10:00:00.000Z'), // 2 days later, same time
        }),
      );

      jest.useRealTimers();
    });

    it('should handle year transition for MONTHLY_AWARD', async () => {
      // Mock current date to end of December (2024-12-31)
      const mockEndDecember = new Date('2024-12-31T10:00:00Z');
      jest.useFakeTimers();
      jest.setSystemTime(mockEndDecember);

      await (processor as any).awardBonus('user-1', '3000', 'MONTHLY_AWARD', 'test-period');

      expect(mockBonusTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          amount: '3000',
          bonusType: 'MONTHLY_AWARD',
          expiredAt: new Date('2025-01-01T00:00:00.000Z'), // First day of January (next month)
        }),
      );

      jest.useRealTimers();
    });
  });
});
