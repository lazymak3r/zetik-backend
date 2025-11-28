import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetTypeEnum, UserEntity } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { DataSource } from 'typeorm';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { UserCacheService } from '../../common/services/user-cache.service';
import { DailyGamblingStatsService } from '../../users/daily-gambling-stats.service';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { UsersService } from '../../users/users.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { BalanceService } from '../balance.service';
import { CryptoConverterService } from '../services/crypto-converter.service';

describe('BalanceService - TIP functionality', () => {
  let service: BalanceService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let usersService: any;

  const mockSender = {
    id: 'user-1',
    username: 'sender',
    displayName: 'Sender User',
    avatarUrl: 'avatar1.jpg',
  } as UserEntity;

  const mockRecipient = {
    id: 'user-2',
    username: 'recipient',
    displayName: 'Recipient User',
    avatarUrl: 'avatar2.jpg',
  } as UserEntity;

  beforeEach(async () => {
    eventEmitter = {
      emit: jest.fn(),
      emitAsync: jest.fn().mockResolvedValue(undefined),
      setMaxListeners: jest.fn(),
    } as any;

    usersService = {
      findById: jest.fn(),
      findByEmailOrUsername: jest.fn(),
    };

    const mockDistributedLockService = {
      withLock: jest.fn((resource, ttl, fn) => fn()),
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    } as any;

    const mockDataSource = {
      createQueryRunner: jest.fn(() => ({
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          getRepository: jest.fn(() => ({
            findOne: jest.fn().mockResolvedValue(null),
          })),
          findOne: jest.fn().mockResolvedValue(null),
        },
      })),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: CryptoConverterService,
          useValue: {
            toUsd: jest.fn().mockResolvedValue('50000'),
            getRate: jest.fn().mockResolvedValue('50000'),
          },
        },
        {
          provide: EventEmitter2,
          useValue: eventEmitter,
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
          },
        },
        {
          provide: DailyGamblingStatsService,
          useValue: {
            updateStats: jest.fn(),
          },
        },
        {
          provide: DistributedLockService,
          useValue: mockDistributedLockService,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: UserCacheService,
          useValue: {
            invalidate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);

    // Mock updateBalance to simulate successful operations
    jest.spyOn(service as any, 'updateBalance').mockResolvedValue({
      success: true,
      balance: '1.00000000',
    });
  });

  describe('tip', () => {
    it('should emit balance.tip event when publicTip is true', async () => {
      usersService.findById.mockResolvedValue(mockSender);
      usersService.findByEmailOrUsername.mockResolvedValue(mockRecipient);

      const tipInput = {
        toUsername: 'recipient',
        amount: new BigNumber('0.001'),
        asset: AssetTypeEnum.BTC,
        publicTip: true,
        message: 'Great job!',
      };

      await service.tip('user-1', tipInput as any);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith('balance.tip', {
        sender: mockSender,
        recipient: mockRecipient,
        asset: AssetTypeEnum.BTC,
        amount: new BigNumber('0.001'),
      });
    });

    it('should NOT emit event when publicTip is false', async () => {
      usersService.findById.mockResolvedValue(mockSender);
      usersService.findByEmailOrUsername.mockResolvedValue(mockRecipient);

      const tipInput = {
        toUsername: 'recipient',
        amount: new BigNumber('0.001'),
        asset: AssetTypeEnum.BTC,
        publicTip: false,
      };

      await service.tip('user-1', tipInput as any);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalledWith('balance.tip', expect.any(Object));
    });

    it('should pass BigNumber amount without converting to string', async () => {
      usersService.findById.mockResolvedValue(mockSender);
      usersService.findByEmailOrUsername.mockResolvedValue(mockRecipient);

      const amount = new BigNumber('0.00123456');
      const tipInput = {
        toUsername: 'recipient',
        amount,
        asset: AssetTypeEnum.BTC,
        publicTip: true,
      };

      await service.tip('user-1', tipInput as any);

      const emitCall = eventEmitter.emitAsync.mock.calls.find((call) => call[0] === 'balance.tip');
      expect(emitCall).toBeDefined();
      expect(emitCall![1].amount).toBeInstanceOf(BigNumber);
      expect(emitCall![1].amount.toString()).toBe('0.00123456');
    });

    it('should reject self-tipping', async () => {
      usersService.findById.mockResolvedValue(mockSender);
      usersService.findByEmailOrUsername.mockResolvedValue(mockSender);

      const tipInput = {
        toUsername: 'sender',
        amount: new BigNumber('0.001'),
        asset: AssetTypeEnum.BTC,
        publicTip: true,
      };

      await expect(service.tip('user-1', tipInput as any)).rejects.toThrow('Cannot tip yourself');
    });

    it('should emit event only after successful transaction commit', async () => {
      usersService.findById.mockResolvedValue(mockSender);
      usersService.findByEmailOrUsername.mockResolvedValue(mockRecipient);

      const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
          getRepository: jest.fn(() => ({
            findOne: jest.fn().mockResolvedValue(null),
          })),
        },
      };

      const mockDataSource = {
        createQueryRunner: jest.fn(() => mockQueryRunner),
      };

      (service as any).dataSource = mockDataSource;

      const tipInput = {
        toUsername: 'recipient',
        amount: new BigNumber('0.001'),
        asset: AssetTypeEnum.BTC,
        publicTip: true,
      };

      await service.tip('user-1', tipInput as any);

      const commitCallOrder = mockQueryRunner.commitTransaction.mock.invocationCallOrder[0];
      const emitCallOrder = eventEmitter.emitAsync.mock.invocationCallOrder[0];

      expect(commitCallOrder).toBeLessThan(emitCallOrder);
    });
  });
});
