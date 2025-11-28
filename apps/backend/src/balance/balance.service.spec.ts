import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm';
import { DailyGamblingStatsService } from '../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { NotificationService } from '../websocket/services/notification.service';
import { BalanceService } from './balance.service';
import { CryptoConverterService } from './services/crypto-converter.service';

class MockNotificationService {
  sendToUser = jest.fn();
  sendToUsers = jest.fn();
  broadcast = jest.fn();
  sendBalanceUpdate = jest.fn();
  notifyUser = jest.fn();
}

describe('BalanceService updateBalance', () => {
  let service: BalanceService;
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    },
  } as any;
  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    getRepository: jest.fn().mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) }),
  } as unknown as DataSource;
  const mockCrypto = {
    getRate: jest.fn(),
    toUsd: jest.fn(),
    fromUsd: jest.fn(),
    toCents: jest.fn(),
    fromCents: jest.fn(),
  } as unknown as CryptoConverterService;
  const mockEmitter = {
    emitAsync: jest.fn(),
    emit: jest.fn(),
    setMaxListeners: jest.fn(),
  } as unknown as EventEmitter2;
  const mockSelfExclusion = {
    getActiveSelfExclusions: jest.fn(),
    hasActiveSelfExclusion: jest.fn(),
  } as unknown as SelfExclusionService;
  const mockDailyGamblingStats = {
    updateStats: jest.fn(),
    getStats: jest.fn(),
    getDailyStats: jest.fn(),
    updateDepositStats: jest.fn(),
    getTotalLossAmount: jest.fn(),
  } as unknown as DailyGamblingStatsService;

  const mockDistributedLockService = {
    withLock: jest.fn((resource, ttl, fn) => fn()),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  } as any;

  beforeEach(() => {
    const mockAffiliateCommissionService = {
      accumulateCommission: jest.fn(),
    } as any;

    service = new BalanceService(
      mockDataSource,
      mockCrypto,
      mockEmitter,
      new MockNotificationService() as unknown as NotificationService,
      mockSelfExclusion,
      mockDailyGamblingStats,
      mockDistributedLockService,
      mockAffiliateCommissionService,
    );
    jest.clearAllMocks();
    // Stub event emitter to prevent .catch errors
    mockEmitter.emitAsync = jest.fn().mockResolvedValue(undefined);
    mockEmitter.emit = jest.fn();
    // Stub history repository for idempotency
    mockQueryRunner.manager.getRepository = jest
      .fn()
      .mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });
    // Stub internals
    mockQueryRunner.manager.findOne.mockResolvedValue(null);
    jest
      .spyOn(service as any, 'updateWalletAndHistoryAtomic')
      .mockResolvedValue({ balance: '0.1' });
    jest.spyOn(service as any, 'updateStatisticsAtomic').mockResolvedValue(undefined);
    jest.spyOn(service, 'validateFinancialOperation').mockImplementation();
    jest.spyOn(service, 'checkLossLimits').mockResolvedValue(undefined);
  });

  it('should deposit and return new balance', async () => {
    const dto = {
      operation: BalanceOperationEnum.DEPOSIT,
      operationId: 'op-dep',
      userId: 'u1',
      amount: new BigNumber(0.1),
      asset: AssetTypeEnum.BTC,
    };
    const result = await service.updateBalance(dto as any);
    expect(result).toEqual({
      success: true,
      status: BalanceOperationResultEnum.SUCCESS,
      balance: '0.1',
    });
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('should process batch BET+WIN and return aggregated balance', async () => {
    const betDto = {
      operation: BalanceOperationEnum.BET,
      operationId: 'op-bet',
      userId: 'u1',
      amount: new BigNumber(1),
      asset: AssetTypeEnum.BTC,
    };
    const winDto = {
      operation: BalanceOperationEnum.WIN,
      operationId: 'op-win',
      userId: 'u1',
      amount: new BigNumber(2),
      asset: AssetTypeEnum.BTC,
    };
    const result = await service.updateBalance([betDto as any, winDto as any]);
    expect(result).toEqual({
      success: true,
      status: BalanceOperationResultEnum.SUCCESS,
      balance: '0.1',
    });
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });
});
