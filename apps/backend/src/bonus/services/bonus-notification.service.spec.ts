import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BonusNotificationEntity,
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { NotificationService } from '../../websocket/services/notification.service';
import { BonusNotificationService } from './bonus-notification.service';

describe('BonusNotificationService', () => {
  let service: BonusNotificationService;
  let notificationRepoMock: jest.Mocked<Repository<BonusNotificationEntity>>;
  let notificationServiceMock: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonusNotificationService,
        {
          provide: getRepositoryToken(BonusNotificationEntity),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUserAndSave: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BonusNotificationService>(BonusNotificationService);
    notificationRepoMock = module.get(getRepositoryToken(BonusNotificationEntity));
    notificationServiceMock = module.get(NotificationService);
  });

  describe('createBonusNotification', () => {
    it('should create notification for pending bonus with bonus_awarded type', async () => {
      const bonusTransaction: BonusTransactionEntity = {
        id: 'bonus-123',
        userId: 'user-456',
        amount: '1000',
        bonusType: BonusTypeEnum.WEEKLY_AWARD,
        status: BonusTransactionStatusEnum.PENDING,
        description: 'Weekly bonus',
        expiredAt: new Date('2025-12-31'),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotification = {
        userId: 'user-456',
        bonusTransactionId: 'bonus-123',
        type: 'bonus_awarded',
        title: 'New Bonus Available!',
        message: 'You have received a Weekly Bonus of $10.00',
        data: expect.any(Object),
      };

      notificationRepoMock.create.mockReturnValue(mockNotification as any);
      notificationRepoMock.save.mockResolvedValue(mockNotification as any);

      await service.createBonusNotification(bonusTransaction);

      expect(notificationRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          bonusTransactionId: 'bonus-123',
          type: 'bonus_awarded',
          title: 'New Bonus Available!',
          message: 'You have received a Weekly Bonus of $10.00',
        }),
      );
      expect(notificationRepoMock.save).toHaveBeenCalled();
      expect(notificationServiceMock.sendToUserAndSave).toHaveBeenCalledWith(
        'user-456',
        expect.objectContaining({
          type: 'bonus_awarded',
        }),
      );
    });

    it('should not create notification for non-pending bonus', async () => {
      const bonusTransaction: BonusTransactionEntity = {
        id: 'bonus-123',
        userId: 'user-456',
        amount: '1000',
        bonusType: BonusTypeEnum.WEEKLY_AWARD,
        status: BonusTransactionStatusEnum.CLAIMED,
        description: 'Weekly bonus',
        expiredAt: new Date('2025-12-31'),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedAt: new Date(),
      };

      await service.createBonusNotification(bonusTransaction);

      expect(notificationRepoMock.create).not.toHaveBeenCalled();
      expect(notificationRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('createBonusClaimedNotification', () => {
    it('should create notification for claimed bonus with bonus_claimed type', async () => {
      const bonusTransaction: BonusTransactionEntity = {
        id: 'bonus-123',
        userId: 'user-456',
        amount: '2500',
        bonusType: BonusTypeEnum.MONTHLY_AWARD,
        status: BonusTransactionStatusEnum.CLAIMED,
        description: 'Monthly bonus',
        expiredAt: new Date('2025-12-31'),
        claimedAt: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockNotification = {
        userId: 'user-456',
        bonusTransactionId: 'bonus-123',
        type: 'bonus_claimed',
        title: 'Bonus Claimed Successfully!',
        message: 'You have successfully claimed a Monthly Bonus of $25.00',
        data: expect.any(Object),
      };

      notificationRepoMock.create.mockReturnValue(mockNotification as any);
      notificationRepoMock.save.mockResolvedValue(mockNotification as any);

      await service.createBonusClaimedNotification(bonusTransaction);

      expect(notificationRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-456',
          bonusTransactionId: 'bonus-123',
          type: 'bonus_claimed',
          title: 'Bonus Claimed Successfully!',
          message: 'You have successfully claimed a Monthly Bonus of $25.00',
        }),
      );
      expect(notificationRepoMock.save).toHaveBeenCalled();
      expect(notificationServiceMock.sendToUserAndSave).toHaveBeenCalledWith(
        'user-456',
        expect.objectContaining({
          type: 'bonus_claimed',
        }),
      );
    });

    it('should not create notification for non-claimed bonus', async () => {
      const bonusTransaction: BonusTransactionEntity = {
        id: 'bonus-123',
        userId: 'user-456',
        amount: '2500',
        bonusType: BonusTypeEnum.MONTHLY_AWARD,
        status: BonusTransactionStatusEnum.PENDING,
        description: 'Monthly bonus',
        expiredAt: new Date('2025-12-31'),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await service.createBonusClaimedNotification(bonusTransaction);

      expect(notificationRepoMock.create).not.toHaveBeenCalled();
      expect(notificationRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('getBonusTypeDisplayName', () => {
    it('should return correct display names for known bonus types', () => {
      const testCases = [
        { input: 'WEEKLY_AWARD', expected: 'Weekly Bonus' },
        { input: 'MONTHLY_AWARD', expected: 'Monthly Bonus' },
        { input: 'LEVEL_UP', expected: 'Level Up Bonus' },
        { input: 'RANK_UP', expected: 'Rank Up Bonus' },
        { input: 'RAKEBACK', expected: 'Rakeback Bonus' },
        { input: 'WEEKLY_RACE_PRIZE', expected: 'Weekly Race Prize' },
        { input: 'WEEKLY_RELOAD', expected: 'Weekly Reload Bonus' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = service['getBonusTypeDisplayName'](input);
        expect(result).toBe(expected);
      });
    });

    it('should format unknown bonus types correctly', () => {
      const result = service['getBonusTypeDisplayName']('SPECIAL_PROMO_BONUS');
      expect(result).toBe('Special Promo Bonus');
    });

    it('should handle single word bonus types', () => {
      const result = service['getBonusTypeDisplayName']('BONUS');
      expect(result).toBe('Bonus');
    });

    it('should handle lowercase bonus types', () => {
      const result = service['getBonusTypeDisplayName']('custom_bonus');
      expect(result).toBe('Custom Bonus');
    });
  });

  describe('getUnviewedNotifications', () => {
    it('should retrieve unviewed notifications for a user', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-456',
          isViewed: false,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'user-456',
          isViewed: false,
          createdAt: new Date(),
        },
      ];

      notificationRepoMock.find.mockResolvedValue(mockNotifications as any);

      const result = await service.getUnviewedNotifications('user-456');

      expect(result).toEqual(mockNotifications);
      expect(notificationRepoMock.find).toHaveBeenCalledWith({
        where: { userId: 'user-456', isViewed: false },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getLastNotifications', () => {
    it('should retrieve last 10 notifications for a user', async () => {
      const mockNotifications = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `notif-${i}`,
          userId: 'user-456',
          isViewed: i < 5,
          createdAt: new Date(),
        }));

      notificationRepoMock.find.mockResolvedValue(mockNotifications as any);

      const result = await service.getLastNotifications('user-456');

      expect(result).toEqual(mockNotifications);
      expect(notificationRepoMock.find).toHaveBeenCalledWith({
        where: { userId: 'user-456' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('markNotificationsAsViewed', () => {
    it('should mark all unviewed notifications as viewed', async () => {
      notificationRepoMock.update.mockResolvedValue({ affected: 3 } as any);

      await service.markNotificationsAsViewed('user-456');

      expect(notificationRepoMock.update).toHaveBeenCalledWith(
        { userId: 'user-456', isViewed: false },
        {
          isViewed: true,
          viewedAt: expect.any(Date),
        },
      );
    });
  });

  describe('getUnviewedCount', () => {
    it('should return count of unviewed notifications', async () => {
      notificationRepoMock.count.mockResolvedValue(5);

      const result = await service.getUnviewedCount('user-456');

      expect(result).toBe(5);
      expect(notificationRepoMock.count).toHaveBeenCalledWith({
        where: { userId: 'user-456', isViewed: false },
      });
    });
  });
});
