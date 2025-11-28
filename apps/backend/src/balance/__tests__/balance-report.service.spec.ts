import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceOperationEnum } from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { DailyGamblingStatsService } from '../../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { BalanceService } from '../balance.service';
import { CryptoConverterService } from '../services/crypto-converter.service';

// Mock NotificationService class
class MockNotificationService {
  sendToUser = jest.fn();
  sendToUsers = jest.fn();
  broadcast = jest.fn();
}

describe('BalanceService - Balance Report', () => {
  let service: BalanceService;
  let dataSource: jest.Mocked<DataSource>;

  const mockQueryBuilder = {
    createQueryBuilder: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };

  let mockRepository: any;
  let mockDataSource: any;
  let mockCryptoConverter: any;
  let mockEmitter: any;
  let mockNotificationService: MockNotificationService;
  let mockSelfExclusionService: any;

  beforeEach(() => {
    // Setup mocks
    mockRepository = { createQueryBuilder: jest.fn(() => mockQueryBuilder) };
    mockDataSource = { getRepository: jest.fn(() => mockRepository) } as unknown as DataSource;
    mockCryptoConverter = {
      toUsd: jest.fn(),
      getRate: jest.fn().mockReturnValue('50000'),
      fromUsd: jest.fn().mockReturnValue('0.002'),
      toCents: jest.fn().mockReturnValue('500.20'),
      fromCents: jest.fn().mockReturnValue('0.002'),
    } as unknown as CryptoConverterService;
    mockEmitter = {
      emit: jest.fn(),
      emitAsync: jest.fn().mockResolvedValue(undefined),
      setMaxListeners: jest.fn(),
    } as unknown as EventEmitter2;
    mockNotificationService = new MockNotificationService();
    mockSelfExclusionService = {
      getActiveSelfExclusions: jest.fn(),
      hasActiveSelfExclusion: jest.fn(),
    };

    const mockDailyGamblingStats = {
      updateStats: jest.fn(),
      getStats: jest.fn(),
      getDailyStats: jest.fn(),
    } as unknown as DailyGamblingStatsService;

    const mockDistributedLockService = {
      withLock: jest.fn((resource, ttl, fn) => fn()),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    } as any;

    // Instantiate service manually
    const mockAffiliateCommissionService = {
      accumulateCommission: jest.fn(),
    } as any;

    service = new BalanceService(
      mockDataSource,
      mockCryptoConverter,
      mockEmitter,
      mockNotificationService as unknown as NotificationService,
      mockSelfExclusionService as unknown as SelfExclusionService,
      mockDailyGamblingStats,
      mockDistributedLockService,
      mockAffiliateCommissionService,
    );
    dataSource = mockDataSource;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getWagerForPeriod', () => {
    it('should return net wager for user in period', async () => {
      // Arrange
      const userId = 'user123';
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      mockQueryBuilder.getRawOne.mockResolvedValue({ netWager: '150.50' });

      // Act
      const result = await service.getWagerForPeriod(userId, fromDate, toDate);

      // Assert
      expect(result).toBe('150.50');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        'COALESCE(SUM(CASE WHEN history.operation = :bet THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END) - SUM(CASE WHEN history.operation = :refund THEN CAST(history.amountCents AS DECIMAL) ELSE 0 END), 0)',
        'netWager',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('history.userId = :userId', { userId });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('history.createdAt >= :from', {
        from: fromDate,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('history.createdAt <= :to', {
        to: toDate,
      });
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        bet: BalanceOperationEnum.BET,
        refund: BalanceOperationEnum.REFUND,
      });
    });

    it('should return 0 when no wager found', async () => {
      // Arrange
      const userId = 'user123';
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      // Act
      const result = await service.getWagerForPeriod(userId, fromDate, toDate);

      // Assert
      expect(result).toBe('0');
    });
  });

  describe('getUsersBalanceReport', () => {
    it('should return balance report for multiple users', async () => {
      // Arrange
      const userIds = ['user1', 'user2', 'user3'];
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      const mockReports = [
        {
          userId: 'user1',
          totalWager: '100.00',
          totalWins: '80.00',
          netWager: '95.00',
          totalDeposits: '500.00',
          totalWithdrawals: '200.00',
          transactionCount: '15',
        },
        {
          userId: 'user2',
          totalWager: '200.00',
          totalWins: '150.00',
          netWager: '190.00',
          totalDeposits: '1000.00',
          totalWithdrawals: '300.00',
          transactionCount: '25',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockReports);

      // Act
      const result = await service.getUsersBalanceReport(userIds, fromDate, toDate);

      // Assert
      expect(result).toEqual([
        {
          userId: 'user1',
          totalWager: '100.00',
          totalWins: '80.00',
          netWager: '95.00',
          totalDeposits: '500.00',
          totalWithdrawals: '200.00',
          transactionCount: 15,
        },
        {
          userId: 'user2',
          totalWager: '200.00',
          totalWins: '150.00',
          netWager: '190.00',
          totalDeposits: '1000.00',
          totalWithdrawals: '300.00',
          transactionCount: 25,
        },
        {
          userId: 'user3',
          totalWager: '0',
          totalWins: '0',
          netWager: '0',
          totalDeposits: '0',
          totalWithdrawals: '0',
          transactionCount: 0,
        },
      ]);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('history.userId IN (:...userIds)', {
        userIds,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('history.createdAt >= :fromDate', {
        fromDate,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('history.createdAt <= :toDate', {
        toDate,
      });
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('history.userId');
    });

    it('should return empty array for empty user list', async () => {
      // Act
      const result = await service.getUsersBalanceReport([], new Date(), new Date());

      // Assert
      expect(result).toEqual([]);
      expect(dataSource.getRepository).not.toHaveBeenCalled();
    });

    it('should throw error for more than 100 users', async () => {
      // Arrange
      const userIds = Array.from({ length: 101 }, (_, i) => `user${i}`);

      // Act & Assert
      await expect(service.getUsersBalanceReport(userIds, new Date(), new Date())).rejects.toThrow(
        'Cannot process more than 100 users at once',
      );
    });

    it('should include users with zero transactions', async () => {
      // Arrange
      const userIds = ['user1', 'user2'];
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      // Only user1 has transactions
      const mockReports = [
        {
          userId: 'user1',
          totalWager: '100.00',
          totalWins: '80.00',
          netWager: '95.00',
          totalDeposits: '500.00',
          totalWithdrawals: '200.00',
          transactionCount: '15',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockReports);

      // Act
      const result = await service.getUsersBalanceReport(userIds, fromDate, toDate);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user1');
      expect(result[0].transactionCount).toBe(15);
      expect(result[1].userId).toBe('user2');
      expect(result[1].transactionCount).toBe(0);
      expect(result[1].totalWager).toBe('0');
    });

    it('should handle all operation types correctly', async () => {
      // Arrange
      const userIds = ['user1'];
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');

      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      // Act
      await service.getUsersBalanceReport(userIds, fromDate, toDate);

      // Assert
      expect(mockQueryBuilder.setParameters).toHaveBeenCalledWith({
        bet: BalanceOperationEnum.BET,
        bet2: BalanceOperationEnum.BET,
        win: BalanceOperationEnum.WIN,
        refund: BalanceOperationEnum.REFUND,
        deposit: BalanceOperationEnum.DEPOSIT,
        withdraw: BalanceOperationEnum.WITHDRAW,
      });
    });
  });
});
