import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AffiliateCampaignEntity } from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { CryptoConverterService } from '../../balance/services/crypto-converter.service';
import { UsersService } from '../../users/users.service';
import { NotificationService } from '../../websocket/services/notification.service';
import { AffiliateService } from '../affiliate.service';
import { AffiliateWalletService } from '../services/affiliate-wallet.service';

describe('AffiliateService - Campaign Limits', () => {
  let service: AffiliateService;
  let campaignRepository: jest.Mocked<Repository<AffiliateCampaignEntity>>;

  const mockUserId = 'user-123';
  const mockCampaign = {
    id: 'campaign-1',
    userId: mockUserId,
    name: 'Test Campaign',
    code: 'TEST123',
    description: 'Test description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCampaignRepo = {
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockDataSource = {
      createQueryRunner: jest.fn(),
      getRepository: jest.fn(),
    };

    const mockBalanceService = {
      updateBalance: jest.fn(),
    };

    const mockAffiliateWalletService = {
      getOrCreateWallet: jest.fn(),
    };

    const mockUsersService = {
      getUserByReferralCode: jest.fn(),
    };

    const mockCryptoConverter = {
      convertToUSD: jest.fn(),
    };

    const mockNotificationService = {
      sendNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: AffiliateWalletService,
          useValue: mockAffiliateWalletService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: CryptoConverterService,
          useValue: mockCryptoConverter,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: getRepositoryToken(AffiliateCampaignEntity),
          useValue: mockCampaignRepo,
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
    campaignRepository = module.get(getRepositoryToken(AffiliateCampaignEntity));
  });

  describe('createCampaign', () => {
    it('should create campaign when user has less than 3 campaigns', async () => {
      campaignRepository.count.mockResolvedValue(2);
      campaignRepository.findOne.mockResolvedValue(null);
      campaignRepository.create.mockReturnValue(mockCampaign as any);
      campaignRepository.save.mockResolvedValue(mockCampaign as any);

      const result = await service.createCampaign(mockUserId, {
        name: 'New Campaign',
        code: 'NEW123',
        description: 'New description',
      });

      expect(campaignRepository.count).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Campaign');
    });

    it('should throw BadRequestException when user already has 3 campaigns', async () => {
      campaignRepository.count.mockResolvedValue(3);

      await expect(
        service.createCampaign(mockUserId, {
          name: 'Fourth Campaign',
          code: 'FOURTH',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(campaignRepository.count).toHaveBeenCalledWith({ where: { userId: mockUserId } });
      expect(campaignRepository.create).not.toHaveBeenCalled();
      expect(campaignRepository.save).not.toHaveBeenCalled();
    });

    it('should show correct error message when limit reached', async () => {
      campaignRepository.count.mockResolvedValue(3);

      try {
        await service.createCampaign(mockUserId, {
          name: 'Fourth Campaign',
          code: 'FOURTH',
        });
        fail('Should have thrown BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.message).toContain('Maximum 3 campaigns allowed');
          expect(error.message).toContain('delete an existing campaign');
        }
      }
    });

    it('should throw ConflictException when code already exists', async () => {
      campaignRepository.count.mockResolvedValue(2);
      campaignRepository.findOne.mockResolvedValue(mockCampaign as any);

      await expect(
        service.createCampaign(mockUserId, {
          name: 'New Campaign',
          code: 'TEST123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow creating campaign without code', async () => {
      campaignRepository.count.mockResolvedValue(2);
      campaignRepository.findOne.mockResolvedValue(null);
      campaignRepository.create.mockReturnValue(mockCampaign as any);
      campaignRepository.save.mockResolvedValue(mockCampaign as any);

      const result = await service.createCampaign(mockUserId, {
        name: 'Campaign Without Code',
      });

      expect(result).toBeDefined();
      expect(campaignRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getUserCampaigns', () => {
    it('should return campaigns with total count', async () => {
      const campaigns = [
        { ...mockCampaign, id: 'camp-1' },
        { ...mockCampaign, id: 'camp-2' },
        { ...mockCampaign, id: 'camp-3' },
      ];

      campaignRepository.findAndCount.mockResolvedValue([campaigns as any, 3]);

      const result = await service.getUserCampaigns(mockUserId, 1, 5);

      expect(result.campaigns).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(campaignRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 5,
      });
    });

    it('should return empty array with zero total when user has no campaigns', async () => {
      campaignRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getUserCampaigns(mockUserId, 1, 5);

      expect(result.campaigns).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle pagination correctly', async () => {
      const campaigns = [
        { ...mockCampaign, id: 'camp-2' },
        { ...mockCampaign, id: 'camp-3' },
      ];

      campaignRepository.findAndCount.mockResolvedValue([campaigns as any, 3]);

      const result = await service.getUserCampaigns(mockUserId, 2, 2);

      expect(result.campaigns).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(campaignRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: 'DESC' },
        skip: 2,
        take: 2,
      });
    });

    it('should return total as 3 when user has maximum campaigns', async () => {
      const campaigns = Array(3)
        .fill(null)
        .map((_, i) => ({ ...mockCampaign, id: `camp-${i}` }));

      campaignRepository.findAndCount.mockResolvedValue([campaigns as any, 3]);

      const result = await service.getUserCampaigns(mockUserId, 1, 10);

      expect(result.total).toBe(3);
      expect(result.campaigns).toHaveLength(3);
    });
  });
});
