import { Test, TestingModule } from '@nestjs/testing';
import { BonusTypeEnum, BonusVipTierEntity, UserVipStatusEntity } from '@zetik/shared-entities';
import { UsersService } from '../../../users/users.service';
import { NotificationService } from '../../../websocket/services/notification.service';
import { IBetConfirmedEventPayload } from '../../interfaces/ibet-confirmed-event-payload.interface';
import { IBetRefundedEventPayload } from '../../interfaces/ibet-refunded-event-payload.interface';
import { BetConfirmedHandlerService } from '../bet-confirmed-handler.service';
import { BonusTransactionService } from '../bonus-transaction.service';
import { IntercomService } from '../intercom.service';
import { UserVipStatusService } from '../user-vip-status.service';
import { VipTierService } from '../vip-tier.service';

describe('BetConfirmedHandlerService', () => {
  let service: BetConfirmedHandlerService;
  let userVipStatusService: jest.Mocked<UserVipStatusService>;
  let vipTierService: jest.Mocked<VipTierService>;

  let mockVipTier0: BonusVipTierEntity;
  mockVipTier0 = {
    level: 0,
    name: 'Visitor',
    wagerRequirement: '0.00',
    isForVip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVipTier1: BonusVipTierEntity = {
    level: 1,
    name: 'Bronze I',
    wagerRequirement: '1000.00', // $10 in cents
    weeklyBonusPercentage: '0.50',
    monthlyBonusPercentage: '1.50',
    levelUpBonusAmount: '2500.00',
    rakebackPercentage: '5.00',
    isForVip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVipTier2: BonusVipTierEntity = {
    level: 2,
    name: 'Bronze II',
    wagerRequirement: '5000.00', // $50 in cents
    weeklyBonusPercentage: '1.00',
    monthlyBonusPercentage: '3.00',
    levelUpBonusAmount: '5000.00',
    rakebackPercentage: '5.00',
    isForVip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVipTier3: BonusVipTierEntity = {
    level: 3,
    name: 'Bronze III',
    wagerRequirement: '10000.00', // $100 in cents
    weeklyBonusPercentage: '2.00',
    monthlyBonusPercentage: '5.00',
    levelUpBonusAmount: '7500.00', // $75 in cents
    rakebackPercentage: '5.00',
    isForVip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetConfirmedHandlerService,
        {
          provide: BonusTransactionService,
          useValue: {
            createTransaction: jest.fn(),
          },
        },
        {
          provide: UserVipStatusService,
          useValue: {
            incrementUserWager: jest.fn(),
            upsertUserVipStatus: jest.fn(),
            logBonusTransaction: jest.fn(),
          },
        },
        {
          provide: VipTierService,
          useValue: {
            findAllTiers: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUser: jest.fn(),
            sendBalanceUpdate: jest.fn(),
            notifyUser: jest.fn(),
            notifyVipTierChange: jest.fn(),
            notifyBonusReceived: jest.fn(),
            sendSystemNotification: jest.fn(),
            emit: jest.fn(),
          },
        },
        {
          provide: IntercomService,
          useValue: {
            updateUser: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BetConfirmedHandlerService>(BetConfirmedHandlerService);
    userVipStatusService = module.get(UserVipStatusService);
    vipTierService = module.get(VipTierService);

    // Default mocks
    vipTierService.findAllTiers.mockResolvedValue([
      mockVipTier0,
      mockVipTier1,
      mockVipTier2,
      mockVipTier3,
    ]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    vipTierService.findAllTiers.mockResolvedValue([
      mockVipTier0,
      mockVipTier1,
      mockVipTier2,
      mockVipTier3,
    ]);
  });

  describe('handleBetConfirmed', () => {
    const mockPayload: IBetConfirmedEventPayload = {
      userId: 'user-123',
      betAmount: '100050', // 1000.50 USD in cents
      operationId: 'op-123',
      asset: 'USDT',
    };

    it('should calculate netWager correctly', async () => {
      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '90025.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(mockPayload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '90025.00');
    });

    it('should handle zero refunds', async () => {
      const payload = { ...mockPayload };
      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '100050.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '100050.00');
    });

    it('should handle negative netWager (large refunds)', async () => {
      const payload = { ...mockPayload };
      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '-49950.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '-49950.00');

      // Should not trigger any level-up for negative wager
      expect(userVipStatusService.logBonusTransaction).not.toHaveBeenCalled();
    });

    it('should not trigger level-up when wager insufficient', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '500', // 5.00 USD in cents
        operationId: 'op-456',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '500.00', // 500 cents (5.00 USD)
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.logBonusTransaction).not.toHaveBeenCalled();
    });

    it('should trigger single level-up (0 -> 1)', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '1500', // 15.00 USD in cents
        operationId: 'op-789',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '1500.00', // 1500 cents (15.00 USD)
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValueOnce(mockUserStatus);
      userVipStatusService.upsertUserVipStatus.mockResolvedValueOnce({
        ...mockUserStatus,
        currentVipLevel: 1,
        previousVipLevel: 0,
      });

      await service.handleBetConfirmed(payload);

      // Should award Bronze bonus
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledTimes(1);
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledWith({
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '2500.00', // 2500.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze I',
        relatedVipTierLevel: 1,
        metadata: {},
      });

      // Should update VIP status
      expect(userVipStatusService.upsertUserVipStatus).toHaveBeenCalledWith('user-123', {
        currentVipLevel: 1,
        previousVipLevel: 0,
      });
    });

    it('should trigger multi-level progression (0 -> 3)', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '12000', // 120.00 USD in cents
        operationId: 'op-multi',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '12000.00', // 12000 cents (120.00 USD)
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValueOnce(mockUserStatus);
      userVipStatusService.upsertUserVipStatus.mockResolvedValueOnce({
        ...mockUserStatus,
        currentVipLevel: 3,
        previousVipLevel: 0,
      });

      await service.handleBetConfirmed(payload);

      // Should award all intermediate bonuses (Bronze, Silver, Gold)
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledTimes(3);

      expect(userVipStatusService.logBonusTransaction).toHaveBeenNthCalledWith(1, {
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '2500.00', // 2500.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze I',
        relatedVipTierLevel: 1,
        metadata: {},
      });

      expect(userVipStatusService.logBonusTransaction).toHaveBeenNthCalledWith(2, {
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '5000.00', // 5000.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze II',
        relatedVipTierLevel: 2,
        metadata: {},
      });

      expect(userVipStatusService.logBonusTransaction).toHaveBeenNthCalledWith(3, {
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '7500.00', // 7500.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze III',
        relatedVipTierLevel: 3,
        metadata: {},
      });

      // Should update to highest level
      expect(userVipStatusService.upsertUserVipStatus).toHaveBeenLastCalledWith('user-123', {
        currentVipLevel: 3,
        previousVipLevel: 0,
      });
    });

    it('should handle multi-level progression with all bonuses', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '15000', // $150 in cents
        operationId: 'op-multi',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '15000.00', // $150 in cents
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValueOnce(mockUserStatus);
      userVipStatusService.upsertUserVipStatus.mockResolvedValueOnce({
        ...mockUserStatus,
        currentVipLevel: 3,
        previousVipLevel: 0,
      });

      await service.handleBetConfirmed(payload);

      // Should award bonuses for levels 1, 2, 3 (all have bonuses)
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledTimes(3);

      // Should update to level 3 (Gold)
      expect(userVipStatusService.upsertUserVipStatus).toHaveBeenLastCalledWith('user-123', {
        currentVipLevel: 3,
        previousVipLevel: 0,
      });
    });

    it('should prevent duplicate bonuses using previousVipLevel', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '12000', // 120.00 USD in cents
        operationId: 'op-prevent',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '12000.00', // 12000 cents (120.00 USD)
        currentVipLevel: 1,
        previousVipLevel: 2, // Already received up to level 2
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValueOnce(mockUserStatus);
      userVipStatusService.upsertUserVipStatus.mockResolvedValueOnce({
        ...mockUserStatus,
        currentVipLevel: 3,
        previousVipLevel: 1,
      });

      await service.handleBetConfirmed(payload);

      // Should only award Gold bonus (level 3), not Bronze/Silver again
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledTimes(1);
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledWith({
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '7500.00', // 7500.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze III',
        relatedVipTierLevel: 3,
        metadata: {},
      });
    });

    it('should handle progressive level increases (1 -> 2)', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '6000', // 60.00 USD in cents
        operationId: 'op-progress',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '6000.00', // 6000 cents (60.00 USD)
        currentVipLevel: 1,
        previousVipLevel: 1,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValueOnce(mockUserStatus);
      userVipStatusService.upsertUserVipStatus.mockResolvedValueOnce({
        ...mockUserStatus,
        currentVipLevel: 2,
        previousVipLevel: 1,
      });

      await service.handleBetConfirmed(payload);

      // Should only award Bronze II bonus
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledTimes(1);
      expect(userVipStatusService.logBonusTransaction).toHaveBeenCalledWith({
        operationId: expect.any(String),
        userId: 'user-123',
        amount: '5000.00', // 5000.00 cents from mock data
        bonusType: BonusTypeEnum.LEVEL_UP,
        description: 'Level Up Bonus for Bronze II',
        relatedVipTierLevel: 2,
        metadata: {},
      });
    });

    it('should handle wager update without level change', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '2000', // 20.00 USD in cents
        operationId: 'op-update',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '2000.00', // 2000 cents (20.00 USD)
        currentVipLevel: 1,
        previousVipLevel: 1,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      // Should update wager but not award any bonuses
      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledTimes(1);
      expect(userVipStatusService.logBonusTransaction).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      userVipStatusService.incrementUserWager.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(service.handleBetConfirmed(mockPayload)).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to handle bet confirmed for user user-123:',
        new Error('Database error'),
      );

      loggerSpy.mockRestore();
    });

    it('should handle edge case with zero bets and refunds', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '0',
        operationId: 'op-edge',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '0.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '0.00');
      expect(userVipStatusService.logBonusTransaction).not.toHaveBeenCalled();
    });

    it('should handle decimal precision correctly', async () => {
      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '99999.9', // 999.999 USD in cents (fractional cents)
        operationId: 'op-decimal',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '99999.80', // Result in cents
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '99999.80');
    });

    it('should handle empty tiers array', async () => {
      vipTierService.findAllTiers.mockResolvedValue([]);

      const payload: IBetConfirmedEventPayload = {
        userId: 'user-123',
        betAmount: '100000', // 1000.00 USD in cents
        operationId: 'op-empty',
        asset: 'USDT',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '100000.00', // 100000 cents
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetConfirmed(payload);

      expect(userVipStatusService.logBonusTransaction).not.toHaveBeenCalled();
    });
  });

  describe('handleBetRefunded', () => {
    it('should decrement wager for valid refund', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        refundAmountCents: '100000', // $1000 in cents
        asset: 'BTC',
        operationId: 'op-refund-1',
        description: 'Bet refund',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '50000.00', // After decrement
        currentVipLevel: 1,
        previousVipLevel: 1,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith(
        'user-123',
        '-100000.00',
      );
    });

    it('should skip zero refund amounts', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0',
        refundAmountCents: '0',
        asset: 'BTC',
        operationId: 'op-refund-zero',
        description: 'Zero refund',
      };

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).not.toHaveBeenCalled();
    });

    it('should skip empty refund amounts', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0',
        refundAmountCents: '',
        asset: 'BTC',
        operationId: 'op-refund-empty',
        description: 'Empty refund',
      };

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).not.toHaveBeenCalled();
    });

    it('should handle refund with string amount cents', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0.50000000',
        refundAmountCents: '50000', // $500 in cents as string
        asset: 'BTC',
        operationId: 'op-refund-string',
        description: 'String refund',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '25000.00',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '-50000.00');
    });

    it('should handle large refund amounts', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '10.00000000',
        refundAmountCents: '1000000', // $10,000 in cents
        asset: 'BTC',
        operationId: 'op-refund-large',
        description: 'Large refund',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '0.00', // Could go negative
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith(
        'user-123',
        '-1000000.00',
      );
    });

    it('should handle errors gracefully', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '1.00000000',
        refundAmountCents: '100000',
        asset: 'BTC',
        operationId: 'op-refund-error',
        description: 'Error refund',
      };

      userVipStatusService.incrementUserWager.mockRejectedValue(new Error('Database error'));

      await expect(service.handleBetRefunded(payload)).resolves.not.toThrow();
    });

    it('should handle fractional cent amounts correctly', async () => {
      const payload: IBetRefundedEventPayload = {
        userId: 'user-123',
        refundAmount: '0.12345678',
        refundAmountCents: '12345.67', // Fractional cents
        asset: 'BTC',
        operationId: 'op-refund-fractional',
        description: 'Fractional refund',
      };

      const mockUserStatus: UserVipStatusEntity = {
        userId: 'user-123',
        currentWager: '87654.33',
        currentVipLevel: 0,
        previousVipLevel: 0,
        currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

      await service.handleBetRefunded(payload);

      expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith('user-123', '-12345.67');
    });

    it('should support multiple assets', async () => {
      const assets = ['BTC', 'ETH', 'USDT'];

      for (const asset of assets) {
        const payload: IBetRefundedEventPayload = {
          userId: 'user-123',
          refundAmount: '1.00000000',
          refundAmountCents: '100000',
          asset,
          operationId: `op-refund-${asset}`,
          description: `${asset} refund`,
        };

        const mockUserStatus: UserVipStatusEntity = {
          userId: 'user-123',
          currentWager: '50000.00',
          currentVipLevel: 0,
          previousVipLevel: 0,
          currentBonusVipTier: { imageUrl: 'something' } as BonusVipTierEntity,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        userVipStatusService.incrementUserWager.mockResolvedValue(mockUserStatus);

        await service.handleBetRefunded(payload);

        expect(userVipStatusService.incrementUserWager).toHaveBeenCalledWith(
          'user-123',
          '-100000.00',
        );

        jest.clearAllMocks();
      }
    });
  });
});
