import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BonusVipTierEntity } from '@zetik/shared-entities';
import { UpdateVipTierDto } from './dto/update-vip-tier.dto';
import { VipTiersService } from './vip-tiers.service';

describe('VipTiersService', () => {
  let service: VipTiersService;

  const mockVipTierRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getRawOne: jest.fn(),
    }),
    delete: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VipTiersService,
        {
          provide: getRepositoryToken(BonusVipTierEntity),
          useValue: mockVipTierRepository,
        },
      ],
    }).compile();

    service = module.get<VipTiersService>(VipTiersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllTiers', () => {
    it('should return all VIP tiers sorted by level', async () => {
      const mockTiers = [
        {
          id: '1',
          level: 0,
          name: 'Visitor',
          description: 'Entry level',
          isForVip: false,
          imageUrl: null,
          wagerRequirement: '0',
          levelUpBonusAmount: null,
          rakebackPercentage: '0',
          rankUpBonusAmount: '0',
          weeklyBonusPercentage: '0',
          monthlyBonusPercentage: '0',
          createdBy: 'system',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          level: 1,
          name: 'Bronze',
          description: 'First tier',
          isForVip: false,
          imageUrl: null,
          wagerRequirement: '10000',
          levelUpBonusAmount: '500',
          rakebackPercentage: '1',
          rankUpBonusAmount: '0',
          weeklyBonusPercentage: '0',
          monthlyBonusPercentage: '0',
          createdBy: 'system',
          updatedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockVipTierRepository.find.mockResolvedValue(mockTiers);

      const result = await service.findAllTiers();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Visitor');
      expect(result[0].wagerRequirement).toBe('0.00');
      expect(result[1].name).toBe('Bronze');
      expect(result[1].wagerRequirement).toBe('100.00');
      expect(result[1].levelUpBonusAmount).toBe('5.00');
      expect(mockVipTierRepository.find).toHaveBeenCalledWith({
        order: { level: 'ASC' },
      });
    });
  });

  describe('updateTier', () => {
    it('should update VIP tier successfully', async () => {
      const updateDto: UpdateVipTierDto = {
        name: 'Updated Bronze',
        description: 'Updated description',
        levelUpBonusAmount: '50.00',
      };

      const existingTier = {
        id: 'tier-1',
        level: 1,
        name: 'Bronze',
        description: 'Original description',
        isForVip: false,
        imageUrl: null,
        wagerRequirement: '10000',
        levelUpBonusAmount: '2500',
        rakebackPercentage: '1',
        rankUpBonusAmount: '0',
        weeklyBonusPercentage: '0',
        monthlyBonusPercentage: '0',
        createdBy: 'system',
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTier = {
        ...existingTier,
        name: 'Updated Bronze',
        description: 'Updated description',
        levelUpBonusAmount: '5000',
        updatedBy: 'admin-123',
        updatedAt: new Date(),
      };

      mockVipTierRepository.findOne.mockResolvedValue(existingTier);
      mockVipTierRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockVipTierRepository.findOne
        .mockResolvedValueOnce(existingTier)
        .mockResolvedValueOnce(updatedTier);

      const result = await service.updateTier(1, updateDto, 'admin-123');

      expect(result).toEqual(
        expect.objectContaining({
          level: 1,
          name: 'Updated Bronze',
          description: 'Updated description',
          levelUpBonusAmount: '50.00',
        }),
      );
      expect(mockVipTierRepository.update).toHaveBeenCalledWith(
        { level: 1 },
        expect.objectContaining({
          name: 'Updated Bronze',
          description: 'Updated description',
          levelUpBonusAmount: '5000',
          updatedBy: 'admin-123',
        }),
      );
    });

    it('should throw NotFoundException for non-existent tier', async () => {
      const updateDto: UpdateVipTierDto = {
        name: 'Updated Name',
      };

      mockVipTierRepository.findOne.mockResolvedValue(null);

      await expect(service.updateTier(999, updateDto, 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateTier(999, updateDto, 'admin-123')).rejects.toThrow(
        'VIP Tier not found',
      );
    });
  });

  describe('cancelBonus', () => {
    it('should cancel bonus successfully', async () => {
      // Mock fetch globally
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await service.cancelBonus('bonus-123', 'admin-123');

      expect(result).toEqual({
        success: true,
        message: 'Bonus bonus-123 has been cancelled successfully',
      });
    });

    it('should throw BadRequestException when API call fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(service.cancelBonus('bonus-123', 'admin-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
