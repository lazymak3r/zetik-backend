import { SelfExclusionEntity, SelfExclusionTypeEnum } from '@zetik/shared-entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailTemplateEnum } from '../email/email-templates.enum';
import { MailgunService } from '../email/mailgun.service';
import { DailyGamblingStatsService } from './daily-gambling-stats.service';
import { SelfExclusionService } from './self-exclusion.service';

describe('SelfExclusionService', () => {
  let service: SelfExclusionService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  const mockMailgunService = {
    sendTemplateEmail: jest.fn(),
  };

  const mockDailyGamblingStatsService = {
    getTotalDepositAmount: jest.fn(),
    getTotalLossAmount: jest.fn(),
    getTotalWagersForPeriod: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SelfExclusionService,
        {
          provide: getRepositoryToken(SelfExclusionEntity),
          useValue: mockRepository,
        },
        {
          provide: MailgunService,
          useValue: mockMailgunService,
        },
        {
          provide: DailyGamblingStatsService,
          useValue: mockDailyGamblingStatsService,
        },
      ],
    }).compile();

    service = module.get<SelfExclusionService>(SelfExclusionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSelfExclusion', () => {
    it('should send cooldown confirmation email when creating a cooldown', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const createDto = {
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType: null,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'cooldown-id',
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        endDate: new Date(),
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockResolvedValue(undefined);

      await service.createSelfExclusion(userId, userEmail, createDto as any);

      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalledWith(
        userEmail,
        EmailTemplateEnum.SELF_EXCLUSION_COOLDOWN,
        expect.objectContaining({
          platformType: expect.any(String),
          endDate: expect.any(String),
          endDateFormatted: expect.any(String),
        }),
      );
    });

    it('should send permanent exclusion email when creating a permanent exclusion', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const createDto = {
        type: SelfExclusionTypeEnum.PERMANENT,
        platformType: null,
      };

      // Mock existing cooldown check
      const recentCooldown = {
        id: 'cooldown-id',
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: false,
        endDate: new Date(),
      };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // No active cooldown
        .mockResolvedValueOnce(recentCooldown); // Recent ended cooldown
      mockRepository.find.mockResolvedValue([]);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'permanent-id',
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockResolvedValue(undefined);

      await service.createSelfExclusion(userId, userEmail, createDto as any);

      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalledWith(
        userEmail,
        EmailTemplateEnum.SELF_EXCLUSION_PERMANENT,
        expect.objectContaining({
          platformType: expect.any(String),
          supportEmail: 'support@zetik.com',
        }),
      );
    });

    it('should handle email sending errors gracefully for cooldown', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const createDto = {
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType: null,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'cooldown-id',
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        endDate: new Date(),
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockRejectedValue(new Error('Email service error'));

      // Should not throw - email failure should be logged but not block operation
      const result = await service.createSelfExclusion(userId, userEmail, createDto as any);

      expect(result.exclusion).toBeDefined();
      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalled();
    });

    it('should handle email sending errors gracefully for permanent exclusion', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const createDto = {
        type: SelfExclusionTypeEnum.PERMANENT,
        platformType: null,
      };

      const recentCooldown = {
        id: 'cooldown-id',
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: false,
        endDate: new Date(),
      };

      mockRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(recentCooldown);
      mockRepository.find.mockResolvedValue([]);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'permanent-id',
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockRejectedValue(new Error('Email service error'));

      // Should not throw - email failure should be logged but not block operation
      const result = await service.createSelfExclusion(userId, userEmail, createDto as any);

      expect(result.exclusion).toBeDefined();
      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalled();
    });
  });

  describe('extendSelfExclusion', () => {
    it('should send extended exclusion email when extending cooldown', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const cooldownId = 'cooldown-id';
      const durationDays = 7;
      const platformType = 'PLATFORM' as any;

      const cooldown = {
        id: cooldownId,
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType,
        postCooldownWindowEnd: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
      };

      mockRepository.findOne.mockResolvedValue(cooldown);
      mockRepository.remove.mockResolvedValue(cooldown);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.TEMPORARY,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'extended-id',
        userId,
        type: SelfExclusionTypeEnum.TEMPORARY,
        endDate: new Date(),
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockResolvedValue(undefined);

      await service.extendSelfExclusion(userId, cooldownId, durationDays, platformType, userEmail);

      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalledWith(
        userEmail,
        EmailTemplateEnum.SELF_EXCLUSION_EXTENDED,
        expect.objectContaining({
          duration: expect.any(String),
          platformType: expect.any(String),
          endDate: expect.any(String),
          exclusionType: expect.any(String),
        }),
      );
    });

    it('should handle email sending errors gracefully when extending', async () => {
      const userId = 'test-user-id';
      const userEmail = 'test@example.com';
      const cooldownId = 'cooldown-id';
      const durationDays = null; // permanent
      const platformType = 'PLATFORM' as any;

      const cooldown = {
        id: cooldownId,
        userId,
        type: SelfExclusionTypeEnum.COOLDOWN,
        platformType,
        postCooldownWindowEnd: new Date(Date.now() + 1000 * 60 * 60),
      };

      mockRepository.findOne.mockResolvedValue(cooldown);
      mockRepository.remove.mockResolvedValue(cooldown);
      mockRepository.create.mockReturnValue({
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockRepository.save.mockResolvedValue({
        id: 'extended-id',
        userId,
        type: SelfExclusionTypeEnum.PERMANENT,
        isActive: true,
      });
      mockMailgunService.sendTemplateEmail.mockRejectedValue(new Error('Email service error'));

      // Should not throw - email failure should be logged but not block operation
      const result = await service.extendSelfExclusion(
        userId,
        cooldownId,
        durationDays,
        platformType,
        userEmail,
      );

      expect(result).toBeDefined();
      expect(mockMailgunService.sendTemplateEmail).toHaveBeenCalled();
    });
  });

  describe('expireOutdatedSelfExclusions', () => {
    it('should enter expired cooldowns into post-cooldown window', async () => {
      const expiredCooldown = {
        id: 'expired-cooldown-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: true,
        endDate: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        postCooldownWindowEnd: null,
      };

      mockRepository.find
        .mockResolvedValueOnce([expiredCooldown]) // Expired cooldowns
        .mockResolvedValueOnce([]) // Expired windows
        .mockResolvedValueOnce([]) // Expired temporary
        .mockResolvedValueOnce([]); // Limits to remove

      mockRepository.save.mockResolvedValue({
        ...expiredCooldown,
        postCooldownWindowEnd: new Date(),
      });

      await service.expireOutdatedSelfExclusions();

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          postCooldownWindowEnd: expect.any(Date),
        }),
      );
    });

    it('should deactivate expired temporary exclusions', async () => {
      const expiredTemporary = {
        id: 'expired-temporary-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.TEMPORARY,
        isActive: true,
        endDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 7 days ago
      };

      mockRepository.find
        .mockResolvedValueOnce([]) // Expired cooldowns
        .mockResolvedValueOnce([]) // Expired windows
        .mockResolvedValueOnce([expiredTemporary]) // Expired temporary
        .mockResolvedValueOnce([]); // Limits to remove

      mockRepository.save.mockResolvedValue({ ...expiredTemporary, isActive: false });

      await service.expireOutdatedSelfExclusions();

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });

    it('should delete cooldowns with expired post-cooldown windows', async () => {
      const expiredWindow = {
        id: 'expired-window-id',
        userId: 'user-id',
        type: SelfExclusionTypeEnum.COOLDOWN,
        isActive: true,
        postCooldownWindowEnd: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      };

      mockRepository.find
        .mockResolvedValueOnce([]) // Expired cooldowns
        .mockResolvedValueOnce([expiredWindow]) // Expired windows
        .mockResolvedValueOnce([]) // Expired temporary
        .mockResolvedValueOnce([]); // Limits to remove

      mockRepository.remove.mockResolvedValue(expiredWindow);

      await service.expireOutdatedSelfExclusions();

      expect(mockRepository.remove).toHaveBeenCalledWith(expiredWindow);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      mockRepository.find.mockRejectedValue(error);

      // Should not throw
      await expect(service.expireOutdatedSelfExclusions()).resolves.not.toThrow();
    });
  });
});
