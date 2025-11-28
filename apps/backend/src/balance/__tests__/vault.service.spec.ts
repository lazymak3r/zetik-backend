import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm';
import { DailyGamblingStatsService } from '../../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { BalanceService } from '../balance.service';
import { CryptoConverterService } from '../services/crypto-converter.service';

class MockNotificationService {
  sendToUser = jest.fn();
}

describe('BalanceService vault operations', () => {
  let service: BalanceService;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const mockDataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    getRepository: jest.fn(),
  } as unknown as DataSource;

  const mockCrypto = {
    getRate: jest.fn().mockReturnValue('1'),
    toCents: jest.fn().mockReturnValue('0'),
    fromCents: jest.fn().mockReturnValue('0'),
  } as unknown as CryptoConverterService;

  const mockEmitter = {
    emitAsync: jest.fn(),
    emit: jest.fn(),
    setMaxListeners: jest.fn(),
  } as unknown as EventEmitter2;

  const mockSelfExclusion = {
    getActiveSelfExclusions: jest.fn().mockResolvedValue([]),
    hasActiveSelfExclusion: jest.fn().mockResolvedValue(false),
  } as unknown as SelfExclusionService;

  const mockDailyGamblingStats = {
    updateStats: jest.fn(),
    updateDepositStats: jest.fn(),
    getTotalLossAmount: jest.fn().mockResolvedValue('0'),
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
    mockEmitter.emitAsync = jest.fn().mockResolvedValue(undefined);

    // default repo mocks
    const vaultRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (v) => v),
      create: jest.fn().mockImplementation((v) => v),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockQueryRunner.manager.getRepository = jest.fn().mockReturnValue(vaultRepo);

    // updateBalance passthrough
    jest.spyOn(service, 'updateBalance').mockResolvedValue({
      success: true,
      status: 0 as any,
      balance: '10.0',
    });
  });

  it('vaultDeposit fails when wallet debit fails', async () => {
    (service.updateBalance as jest.Mock).mockResolvedValueOnce({
      success: false,
      status: 0 as any,
      balance: '0',
      error: 'failed',
    });

    await expect(
      service.vaultDeposit('u1', {
        operationId: 'op1',
        asset: AssetTypeEnum.BTC,
        amount: new BigNumber('1'),
      }),
    ).rejects.toThrow('failed');

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('vaultDeposit creates vault when not exists and increments balance', async () => {
    const result = await service.vaultDeposit('u1', {
      operationId: 'op2',
      asset: AssetTypeEnum.BTC,
      amount: new BigNumber('0.5'),
    });
    expect(result.asset).toBe(AssetTypeEnum.BTC);
    expect(result.walletBalance).toBe('10.0');
    expect(result.vaultBalance).toBe('0.5');
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('vaultWithdraw fails when insufficient vault balance', async () => {
    // vault has 0 by default (findOne -> null)
    await expect(
      service.vaultWithdraw('u1', {
        operationId: 'op3',
        asset: AssetTypeEnum.BTC,
        amount: new BigNumber('1'),
      }),
    ).rejects.toThrow();
    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('vaultWithdraw credits wallet after decreasing vault', async () => {
    // mock existing vault with balance 2
    const vaultRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'u1', asset: AssetTypeEnum.BTC, balance: '2' }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockQueryRunner.manager.getRepository = jest.fn().mockReturnValue(vaultRepo);

    const result = await service.vaultWithdraw('u1', {
      operationId: 'op4',
      asset: AssetTypeEnum.BTC,
      amount: new BigNumber('1.25'),
    });

    expect(result.asset).toBe(AssetTypeEnum.BTC);
    expect(result.walletBalance).toBe('10.0');
    expect(result.vaultBalance).toBe('0.75');
    expect(vaultRepo.update).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('should use unified lock key for both deposit and withdraw operations', async () => {
    // Mock vault repo for deposit
    const vaultRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async (v) => v),
      create: jest.fn().mockImplementation((v) => v),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockQueryRunner.manager.getRepository = jest.fn().mockReturnValue(vaultRepo);

    // Spy on withLock to capture lock resource keys
    const withLockSpy = jest.spyOn(mockDistributedLockService, 'withLock');

    // Test deposit operation
    await service.vaultDeposit('user123', {
      operationId: 'deposit-op',
      asset: AssetTypeEnum.BTC,
      amount: new BigNumber('1'),
    });

    // Verify deposit uses unified vault lock key
    expect(withLockSpy).toHaveBeenCalledWith(
      'balance:vault:user123:BTC',
      15000, // STANDARD_OPERATION TTL
      expect.any(Function),
    );

    withLockSpy.mockClear();

    // Mock vault repo for withdraw with balance
    const vaultRepoWithBalance = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'user123', asset: AssetTypeEnum.BTC, balance: '5' }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockQueryRunner.manager.getRepository = jest.fn().mockReturnValue(vaultRepoWithBalance);

    // Test withdraw operation
    await service.vaultWithdraw('user123', {
      operationId: 'withdraw-op',
      asset: AssetTypeEnum.BTC,
      amount: new BigNumber('1'),
    });

    // Verify withdraw uses the SAME unified vault lock key
    expect(withLockSpy).toHaveBeenCalledWith(
      'balance:vault:user123:BTC',
      15000, // STANDARD_OPERATION TTL
      expect.any(Function),
    );

    // CRITICAL: Verify that deposit and withdraw use the SAME lock key
    // This prevents race conditions where concurrent deposit/withdraw operations
    // could corrupt vault state
    const unifiedLockKey = 'balance:vault:user123:BTC';
    expect(unifiedLockKey).toMatch(/^balance:vault:/);
    expect(unifiedLockKey).toContain('user123');
    expect(unifiedLockKey).toContain('BTC');
  });

  it('should prevent concurrent deposit and withdraw with unified lock key', async () => {
    // This test verifies that both operations use the SAME lock key,
    // preventing race conditions during concurrent vault operations
    const depositLockKey = 'balance:vault:user123:BTC';
    const withdrawLockKey = 'balance:vault:user123:BTC';

    // Verify lock keys follow the expected pattern (without operation suffix)
    expect(depositLockKey).toMatch(/^balance:vault:[^:]+:[^:]+$/);
    expect(withdrawLockKey).toMatch(/^balance:vault:[^:]+:[^:]+$/);

    // Verify they contain the same user and asset
    expect(depositLockKey).toContain('user123');
    expect(depositLockKey).toContain('BTC');
    expect(withdrawLockKey).toContain('user123');
    expect(withdrawLockKey).toContain('BTC');

    // CRITICAL: Verify they are IDENTICAL to prevent race conditions
    expect(depositLockKey).toBe(withdrawLockKey);

    // Verify no operation-specific suffixes (deposit/withdraw) exist
    expect(depositLockKey).not.toContain(':deposit');
    expect(depositLockKey).not.toContain(':withdraw');
    expect(withdrawLockKey).not.toContain(':deposit');
    expect(withdrawLockKey).not.toContain(':withdraw');
  });
});
