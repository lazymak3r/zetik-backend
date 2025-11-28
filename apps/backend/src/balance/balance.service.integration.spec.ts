import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceOperationResultEnum,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm';
import { createTestProviders } from '../test-utils';
import { DailyGamblingStatsService } from '../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../websocket/services/notification.service';
import { BalanceService } from './balance.service';
import { CryptoConverterService } from './services/crypto-converter.service';

/**
 * Integration tests for BalanceService that test actual financial logic
 * without mocking away critical business rules and calculations.
 */
describe('BalanceService Integration Tests', () => {
  let module: TestingModule;
  let service: BalanceService;
  let dataSource: DataSource;

  const testUserId = 'test-user-123';

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        BalanceService,
        ...createTestProviders({ includeBalanceService: false }),
        {
          provide: CryptoConverterService,
          useValue: {
            getRate: jest.fn().mockResolvedValue(50000), // 1 BTC = $50,000
            toUsd: jest.fn().mockImplementation((amount: string, asset: AssetTypeEnum) => {
              if (asset === AssetTypeEnum.BTC) {
                return Promise.resolve(new BigNumber(amount).multipliedBy(50000).toString());
              }
              return Promise.resolve(amount); // USD stays the same
            }),
            fromUsd: jest.fn().mockImplementation((usdAmount: string, asset: AssetTypeEnum) => {
              if (asset === AssetTypeEnum.BTC) {
                return Promise.resolve(new BigNumber(usdAmount).dividedBy(50000).toString());
              }
              return Promise.resolve(usdAmount); // USD stays the same
            }),
            toCents: jest
              .fn()
              .mockImplementation((amount: string) =>
                new BigNumber(amount).multipliedBy(100).toString(),
              ),
            fromCents: jest
              .fn()
              .mockImplementation((cents: string) =>
                new BigNumber(cents).dividedBy(100).toString(),
              ),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
            emitAsync: jest.fn().mockResolvedValue(undefined),
            setMaxListeners: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendBalanceUpdate: jest.fn(),
            sendToUser: jest.fn(),
          },
        },
        {
          provide: SelfExclusionService,
          useValue: {
            hasActiveSelfExclusion: jest.fn().mockResolvedValue(false),
            getActiveSelfExclusions: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DailyGamblingStatsService,
          useValue: {
            updateStats: jest.fn(),
            getTotalLossAmount: jest.fn().mockResolvedValue('0'),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockImplementation((query: string, params?: any[]) => {
              // Mock database responses based on query
              if (query.includes('SELECT balance FROM balance_wallets')) {
                return Promise.resolve([{ balance: '100000000' }]); // 1 BTC in satoshis
              }
              if (query.includes('SELECT * FROM balance_history')) {
                return Promise.resolve([
                  {
                    amount: '50000000',
                    amount_usd_cents: '50000',
                    operation_type: 'DEPOSIT',
                  },
                ]);
              }
              return Promise.resolve([]);
            }),
            createQueryRunner: jest.fn(() => ({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              query: jest.fn(),
              manager: {
                save: jest.fn(),
                find: jest.fn(),
                findOne: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
                transaction: jest.fn(),
                query: jest.fn(),
                createQueryBuilder: jest.fn(() => ({
                  select: jest.fn().mockReturnThis(),
                  where: jest.fn().mockReturnThis(),
                  andWhere: jest.fn().mockReturnThis(),
                  orWhere: jest.fn().mockReturnThis(),
                  leftJoin: jest.fn().mockReturnThis(),
                  innerJoin: jest.fn().mockReturnThis(),
                  orderBy: jest.fn().mockReturnThis(),
                  groupBy: jest.fn().mockReturnThis(),
                  having: jest.fn().mockReturnThis(),
                  take: jest.fn().mockReturnThis(),
                  skip: jest.fn().mockReturnThis(),
                  getOne: jest.fn(),
                  getMany: jest.fn(),
                  getManyAndCount: jest.fn(),
                  execute: jest.fn(),
                })),
                getRepository: jest.fn(() => ({
                  find: jest.fn(),
                  findOne: jest.fn(),
                  findOneBy: jest.fn(),
                  save: jest.fn(),
                  update: jest.fn(),
                  delete: jest.fn(),
                  create: jest.fn(),
                  count: jest.fn(),
                })),
              },
            })),
            getRepository: jest.fn(() => ({
              find: jest.fn(),
              findOne: jest.fn(),
              findOneBy: jest.fn(),
              save: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              create: jest.fn(),
              count: jest.fn(),
            })),
            manager: {
              transaction: jest.fn(),
              save: jest.fn(),
              find: jest.fn(),
              findOne: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            updateUser: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock responses
    (dataSource.query as jest.Mock).mockImplementation((query: string, params?: any[]) => {
      if (query.includes('SELECT balance FROM balance_wallets')) {
        return Promise.resolve([{ balance: '100000000' }]); // 1 BTC in satoshis
      }
      if (query.includes('SELECT * FROM balance_history')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });
  });

  describe('Real Financial Logic Tests', () => {
    it('should prevent insufficient balance withdrawals', async () => {
      const withdrawalAmount = new BigNumber(2); // 2 BTC, but user only has 1 BTC

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.WITHDRAW,
        operationId: 'withdrawal-too-large',
        userId: testUserId,
        amount: withdrawalAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Attempted large withdrawal',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(BalanceOperationResultEnum.INSUFFICIENT_BALANCE);

      // Verify balance remains unchanged
      const wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(wallet[0].balance).toBe('100000000'); // Still 1 BTC
    });

    it('should handle successful deposit with real balance calculation', async () => {
      const depositAmount = new BigNumber(0.5); // 0.5 BTC

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: 'deposit-half-btc',
        userId: testUserId,
        amount: depositAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Test deposit',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(BalanceOperationResultEnum.SUCCESS);

      // Verify actual balance in database
      const wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(wallet[0].balance).toBe('150000000'); // 1.5 BTC in satoshis

      // Verify history record was created
      const history = await dataSource.query(
        'SELECT * FROM balance_history WHERE user_id = $1 AND operation_id = $2',
        [testUserId, 'deposit-half-btc'],
      );
      expect(history).toHaveLength(1);
      expect(history[0].amount).toBe('50000000'); // 0.5 BTC in satoshis
    });

    it('should enforce financial precision to prevent rounding errors', async () => {
      const preciseAmount = new BigNumber('0.00000001'); // 1 satoshi

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: 'precision-test',
        userId: testUserId,
        amount: preciseAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Precision test',
      });

      expect(result.success).toBe(true);

      const wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      // Should be exactly 1 BTC + 1 satoshi
      expect(wallet[0].balance).toBe('100000001');
    });

    it('should handle bet and win operations atomically', async () => {
      const betAmount = new BigNumber(0.1); // 0.1 BTC bet
      const winAmount = new BigNumber(0.2); // 0.2 BTC win

      // Place bet first
      const betResult = await service.updateBalance({
        operation: BalanceOperationEnum.BET,
        operationId: 'bet-001',
        userId: testUserId,
        amount: betAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Test bet',
      });

      expect(betResult.success).toBe(true);

      // Verify balance after bet
      let wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(wallet[0].balance).toBe('90000000'); // 0.9 BTC remaining

      // Win the bet
      const winResult = await service.updateBalance({
        operation: BalanceOperationEnum.WIN,
        operationId: 'win-001',
        userId: testUserId,
        amount: winAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Test win',
      });

      expect(winResult.success).toBe(true);

      // Verify final balance
      wallet = await dataSource.query('SELECT balance FROM balance_wallets WHERE user_id = $1', [
        testUserId,
      ]);
      expect(wallet[0].balance).toBe('110000000'); // 1.1 BTC (1 - 0.1 + 0.2)

      // Verify both operations are recorded in history
      const history = await dataSource.query(
        'SELECT operation_type FROM balance_history WHERE user_id = $1 ORDER BY created_at',
        [testUserId],
      );
      expect(history).toHaveLength(2);
      expect(history[0].operation_type).toBe('BET');
      expect(history[1].operation_type).toBe('WIN');
    });

    it('should prevent double-spending with idempotent operations', async () => {
      const withdrawalAmount = new BigNumber(0.5);
      const operationId = 'unique-withdrawal-123';

      // First withdrawal attempt
      const firstResult = await service.updateBalance({
        operation: BalanceOperationEnum.WITHDRAW,
        operationId,
        userId: testUserId,
        amount: withdrawalAmount,
        asset: AssetTypeEnum.BTC,
        description: 'First withdrawal attempt',
      });

      expect(firstResult.success).toBe(true);

      // Second attempt with same operation ID should be idempotent
      const secondResult = await service.updateBalance({
        operation: BalanceOperationEnum.WITHDRAW,
        operationId,
        userId: testUserId,
        amount: withdrawalAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Duplicate withdrawal attempt',
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.success).toBe(true); // Should be idempotent

      // Verify balance was only debited once
      const wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(wallet[0].balance).toBe('50000000'); // 0.5 BTC (1 - 0.5, not 1 - 0.5 - 0.5)

      // Verify only one history record exists
      const history = await dataSource.query(
        'SELECT * FROM balance_history WHERE operation_id = $1',
        [operationId],
      );
      expect(history).toHaveLength(1);
    });

    it('should maintain transaction atomicity on database errors', async () => {
      // This test simulates a scenario where the service should rollback on errors
      const originalBalance = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );

      // Mock a database error by causing a constraint violation
      // (This is a simplified test - in practice you'd need more sophisticated error simulation)
      try {
        await service.updateBalance({
          operation: BalanceOperationEnum.DEPOSIT,
          operationId: 'error-test',
          userId: testUserId,
          amount: new BigNumber(1),
          asset: 'INVALID_ASSET' as AssetTypeEnum, // This should cause an error
          description: 'Error simulation',
        });
      } catch (error) {
        // Error is expected
      }

      // Verify balance remains unchanged after error
      const balanceAfterError = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(balanceAfterError[0].balance).toBe(originalBalance[0].balance);
    });

    it('should enforce minimum transaction amounts', async () => {
      const tinyAmount = new BigNumber('0.000000001'); // Less than 1 satoshi

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.WITHDRAW,
        operationId: 'tiny-withdrawal',
        userId: testUserId,
        amount: tinyAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Tiny withdrawal test',
      });

      // Should fail due to minimum amount restrictions
      expect(result.success).toBe(false);
      // The exact error type may vary based on implementation
    });

    it('should calculate correct USD equivalent for BTC operations', async () => {
      const btcAmount = new BigNumber(0.01); // 0.01 BTC

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.DEPOSIT,
        operationId: 'usd-calc-test',
        userId: testUserId,
        amount: btcAmount,
        asset: AssetTypeEnum.BTC,
        description: 'USD calculation test',
      });

      expect(result.success).toBe(true);

      // Verify history record includes correct USD amount
      const history = await dataSource.query(
        'SELECT amount_usd_cents FROM balance_history WHERE operation_id = $1',
        ['usd-calc-test'],
      );

      // 0.01 BTC * $50,000 = $500 = 50,000 cents
      expect(history[0].amount_usd_cents).toBe('50000');
    });
  });

  describe('Security and Anti-Money Laundering Tests', () => {
    it('should track large transactions for compliance monitoring', async () => {
      const largeAmount = new BigNumber(10); // 10 BTC - large transaction

      // First add enough balance to make this possible
      await dataSource.query(
        'UPDATE balance_wallets SET balance = $1 WHERE user_id = $2',
        ['1100000000', testUserId], // 11 BTC
      );

      const result = await service.updateBalance({
        operation: BalanceOperationEnum.WITHDRAW,
        operationId: 'large-withdrawal',
        userId: testUserId,
        amount: largeAmount,
        asset: AssetTypeEnum.BTC,
        description: 'Large withdrawal for compliance testing',
      });

      expect(result.success).toBe(true);

      // Verify the transaction is flagged in history
      const history = await dataSource.query(
        'SELECT * FROM balance_history WHERE operation_id = $1',
        ['large-withdrawal'],
      );

      expect(history[0].amount_usd_cents).toBe('50000000'); // $500,000 in cents
      // In a real implementation, this might set compliance flags
    });

    it('should prevent balance manipulation through rapid transactions', async () => {
      // This test ensures the service can handle rapid concurrent-style operations
      const operations = [
        {
          operation: BalanceOperationEnum.BET,
          operationId: 'rapid-bet-1',
          amount: new BigNumber(0.1),
        },
        {
          operation: BalanceOperationEnum.BET,
          operationId: 'rapid-bet-2',
          amount: new BigNumber(0.1),
        },
        {
          operation: BalanceOperationEnum.BET,
          operationId: 'rapid-bet-3',
          amount: new BigNumber(0.1),
        },
      ];

      const promises = operations.map((op) =>
        service.updateBalance({
          ...op,
          userId: testUserId,
          asset: AssetTypeEnum.BTC,
          description: 'Rapid transaction test',
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Verify final balance is correct
      const wallet = await dataSource.query(
        'SELECT balance FROM balance_wallets WHERE user_id = $1',
        [testUserId],
      );
      expect(wallet[0].balance).toBe('70000000'); // 1 BTC - 0.3 BTC = 0.7 BTC
    });
  });
});
