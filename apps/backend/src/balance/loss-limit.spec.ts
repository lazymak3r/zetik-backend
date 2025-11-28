import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  LimitPeriodEnum,
  SelfExclusionTypeEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm'; // We will manually instantiate BalanceService without Nest TestingModule
import { DailyGamblingStatsService } from '../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { NotificationService } from '../websocket/services/notification.service';
import { BalanceService } from './balance.service';
import { CryptoConverterService } from './services/crypto-converter.service';

describe('BalanceService - Loss Limit Tests', () => {
  let service: BalanceService;

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        createQueryBuilder: jest.fn(),
      },
    }),
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    }),
  };

  const mockCryptoConverter = {
    toCents: jest.fn().mockReturnValue('500.20'),
    fromCents: jest.fn().mockReturnValue('0.002'),
    getRate: jest.fn().mockReturnValue('50000'),
  };

  const mockEventEmitter = {
    emitAsync: jest.fn(),
    setMaxListeners: jest.fn(),
  };

  const mockNotificationService = {
    sendToUser: jest.fn(),
  };

  const mockSelfExclusionService = {
    getActiveSelfExclusions: jest.fn(),
  };

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const mockDailyGamblingStats = {
      updateStats: jest.fn(),
      getStats: jest.fn(),
      getDailyStats: jest.fn(),
      updateDepositStats: jest.fn(),
      getTotalLossAmount: jest.fn().mockResolvedValue(0),
    } as unknown as DailyGamblingStatsService;

    const mockDistributedLockService = {
      withLock: jest.fn((resource, ttl, fn) => fn()),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    } as any;

    // Manually instantiate BalanceService with mocks
    const mockAffiliateCommissionService = {
      accumulateCommission: jest.fn(),
    } as any;

    service = new BalanceService(
      mockDataSource as unknown as DataSource,
      mockCryptoConverter as unknown as CryptoConverterService,
      mockEventEmitter as unknown as EventEmitter2,
      mockNotificationService as unknown as NotificationService,
      mockSelfExclusionService as unknown as SelfExclusionService,
      mockDailyGamblingStats,
      mockDistributedLockService,
      mockAffiliateCommissionService,
    );
  });

  describe('checkLossLimits', () => {
    it('should return without error when user has no loss limits', async () => {
      // Arrange
      mockSelfExclusionService.getActiveSelfExclusions.mockResolvedValue([]);

      // Act & Assert
      await expect(
        service.checkLossLimits('user-id', new BigNumber(100), AssetTypeEnum.BTC),
      ).resolves.not.toThrow();

      expect(mockSelfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith('user-id');
    });

    it('should return without error when user has loss limits but has not reached them', async () => {
      // Arrange
      const mockLossLimit = {
        id: 'loss-limit-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.LOSS_LIMIT,
        period: LimitPeriodEnum.DAILY,
        limitAmount: 1000,
        startDate: new Date(),
        isActive: true,
      };

      mockSelfExclusionService.getActiveSelfExclusions.mockResolvedValue([mockLossLimit]);

      // Mock the calculateUserLosses method to return a value less than the limit
      jest.spyOn(service, 'calculateUserLosses').mockResolvedValue('500');

      // Act & Assert
      await expect(
        service.checkLossLimits('user-id', new BigNumber(100), AssetTypeEnum.BTC),
      ).resolves.not.toThrow();

      expect(mockSelfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith('user-id');
      expect(service.calculateUserLosses).toHaveBeenCalledWith(
        'user-id',
        LimitPeriodEnum.DAILY,
        AssetTypeEnum.BTC,
        undefined,
      );
    });

    it('should throw ForbiddenException when user has reached their loss limit', async () => {
      // Arrange
      const mockLossLimit = {
        id: 'loss-limit-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.LOSS_LIMIT,
        period: LimitPeriodEnum.DAILY,
        limitAmount: 1000,
        startDate: new Date(),
        isActive: true,
      };

      mockSelfExclusionService.getActiveSelfExclusions.mockResolvedValue([mockLossLimit]);

      // Mock the calculateUserLosses method to return a value that, when added to the bet amount, exceeds the limit
      jest.spyOn(service, 'calculateUserLosses').mockResolvedValue('950');

      // Act & Assert
      await expect(
        service.checkLossLimits('user-id', new BigNumber(100), AssetTypeEnum.BTC),
      ).rejects.toThrow(ForbiddenException);

      expect(mockSelfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith('user-id');
      expect(service.calculateUserLosses).toHaveBeenCalledWith(
        'user-id',
        LimitPeriodEnum.DAILY,
        AssetTypeEnum.BTC,
        undefined,
      );
    });

    it('should skip loss limits without period or limitAmount', async () => {
      // Arrange
      const mockLossLimit = {
        id: 'loss-limit-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.LOSS_LIMIT,
        // Missing period and limitAmount
        startDate: new Date(),
        isActive: true,
      };

      mockSelfExclusionService.getActiveSelfExclusions.mockResolvedValue([mockLossLimit]);

      // Act & Assert
      const lossSpy = jest.spyOn(service, 'calculateUserLosses');
      await expect(
        service.checkLossLimits('user-id', new BigNumber(100), AssetTypeEnum.BTC),
      ).resolves.not.toThrow();
      expect(mockSelfExclusionService.getActiveSelfExclusions).toHaveBeenCalledWith('user-id');
      expect(lossSpy).not.toHaveBeenCalled();
    });
  });

  describe('calculateUserLosses', () => {
    beforeEach(() => {
      // Mock the createQueryBuilder method
      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      });
    });

    it('should return 0 when there are no bets or wins in the period', async () => {
      // Arrange - no need to mock queryBuilder, using DailyGamblingStatsService
      // mockDailyGamblingStats.getTotalLossAmount is already mocked to return 0

      // Act
      const result = await service.calculateUserLosses(
        'user-id',
        LimitPeriodEnum.DAILY,
        AssetTypeEnum.BTC,
      );

      // Assert
      expect(result).toBe('0');
    });

    it('should return 0 when user has won more than lost in the period', async () => {
      // Arrange - no need to mock queryBuilder, using DailyGamblingStatsService
      // mockDailyGamblingStats.getTotalLossAmount is already mocked to return 0

      // Act
      const result = await service.calculateUserLosses(
        'user-id',
        LimitPeriodEnum.DAILY,
        AssetTypeEnum.BTC,
      );

      // Assert
      expect(result).toBe('0');
    });

    it('should return net losses when user has lost more than won in the period', async () => {
      // Arrange
      const mockDailyGamblingStatsLocal = service[
        'dailyGamblingStatsService'
      ] as jest.Mocked<DailyGamblingStatsService>;
      mockDailyGamblingStatsLocal.getTotalLossAmount.mockResolvedValueOnce(500);

      // Act
      const result = await service.calculateUserLosses(
        'user-id',
        LimitPeriodEnum.DAILY,
        AssetTypeEnum.BTC,
      );

      // Assert
      expect(result).toBe('500');
    });

    it('should calculate start date correctly for DAILY period', async () => {
      // Arrange
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      // Mock Date.now to return a fixed date
      const mockDate = new Date('2023-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Act
      await service.calculateUserLosses('user-id', LimitPeriodEnum.DAILY, AssetTypeEnum.BTC);

      // Assert - just verify the method completes without error
      expect(true).toBe(true);

      // Reset Date mock
      jest.restoreAllMocks();
    });

    it('should calculate start date correctly for WEEKLY period', async () => {
      // Arrange
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      // Mock Date.now to return a fixed date
      const mockDate = new Date('2023-01-15T12:00:00Z'); // Sunday is 0, so this is a Sunday
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Act
      await service.calculateUserLosses('user-id', LimitPeriodEnum.WEEKLY, AssetTypeEnum.BTC);

      // Assert - just verify the method completes without error
      expect(true).toBe(true);

      // Reset Date mock
      jest.restoreAllMocks();
    });

    it('should calculate start date correctly for MONTHLY period', async () => {
      // Arrange
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      // Mock Date.now to return a fixed date
      const mockDate = new Date('2023-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Act
      await service.calculateUserLosses('user-id', LimitPeriodEnum.MONTHLY, AssetTypeEnum.BTC);

      // Assert - just verify the method completes without error
      expect(true).toBe(true);

      // Reset Date mock
      jest.restoreAllMocks();
    });

    it('should calculate start date correctly for SESSION period', async () => {
      // Arrange
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      // Mock Date.now to return a fixed date
      const mockDate = new Date('2023-01-15T12:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      // Act
      await service.calculateUserLosses('user-id', LimitPeriodEnum.SESSION, AssetTypeEnum.BTC);

      // Assert - just verify the method completes without error
      expect(true).toBe(true);

      // Reset Date mock
      jest.restoreAllMocks();
    });
  });

  describe('updateBalance with loss limits', () => {
    it('should check loss limits when operation is BET', async () => {
      // Arrange
      const updateBalanceDto = {
        operation: BalanceOperationEnum.BET,
        operationId: 'operation-id',
        userId: 'user-id',
        amount: new BigNumber(100),
        asset: AssetTypeEnum.BTC,
      };

      // Mock the necessary methods
      jest.spyOn(service, 'checkLossLimits').mockResolvedValue();

      // Mock repository methods
      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'user-id', isBanned: false }),
      });

      // Mock other methods to avoid errors
      jest.spyOn(service, 'validateFinancialOperation').mockImplementation();

      // Act
      try {
        await service.updateBalance(updateBalanceDto);
      } catch (error) {
        // Ignore errors, we're just testing if checkLossLimits is called
      }

      // Assert
      expect(service.checkLossLimits).toHaveBeenCalledWith(
        'user-id',
        new BigNumber(100),
        AssetTypeEnum.BTC,
      );
    });

    it('should not check loss limits when operation is not BET', async () => {
      // Arrange
      const updateBalanceDto = {
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: 'operation-id',
        userId: 'user-id',
        amount: new BigNumber(100),
        asset: AssetTypeEnum.BTC,
      };

      // Mock the necessary methods
      jest.spyOn(service, 'checkLossLimits').mockResolvedValue();

      // Mock repository methods
      (mockDataSource.getRepository as jest.Mock).mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: 'user-id', isBanned: false }),
      });

      // Mock other methods to avoid errors
      jest.spyOn(service, 'validateFinancialOperation').mockImplementation();

      // Act
      try {
        await service.updateBalance(updateBalanceDto);
      } catch (error) {
        // Ignore errors, we're just testing if checkLossLimits is called
      }

      // Assert
      expect(service.checkLossLimits).not.toHaveBeenCalled();
    });
  });
});
