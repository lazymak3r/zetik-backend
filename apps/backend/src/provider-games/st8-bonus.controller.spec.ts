import { AdminEntity } from '@zetik/shared-entities';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSt8BonusDto } from './dto/create-st8-bonus.dto';
import { ISt8BonusResponse } from './interfaces/st8-types.interface';
import { St8BonusController } from './st8-bonus.controller';
import { St8BonusService } from './st8-bonus.service';

describe('St8BonusController', () => {
  let controller: St8BonusController;
  let service: jest.Mocked<St8BonusService>;
  let adminRepository: jest.Mocked<Repository<AdminEntity>>;

  const mockAdminId = 'admin-123';
  const mockAdmin = {
    id: mockAdminId,
    email: 'admin@test.com',
    name: 'Test Admin',
    role: 'admin' as any,
    isActive: true,
    tokenVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AdminEntity;

  const mockBonusData: CreateSt8BonusDto = {
    bonus_id: 'bonus-test-12345',
    game_codes: ['game1', 'game2'],
    currency: 'USD' as any,
    value: '100.00',
    type: 'free_money' as any,
    players: ['player1', 'player2'],
    count: 1,
    site: 'site1',
  };

  const mockSt8Response: ISt8BonusResponse = {
    status: 'ok',
    bonus: {
      bonus_id: 'bonus-test-12345',
      status: 'finished',
      instances: [],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [St8BonusController],
      providers: [
        {
          provide: St8BonusService,
          useValue: {
            getOffers: jest.fn(),
            createBonus: jest.fn(),
            fetchBonus: jest.fn(),
            updateBonusStatusFromSt8: jest.fn(),
            cancelBonus: jest.fn(),
            getLocalBonuses: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AdminEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<St8BonusController>(St8BonusController);
    service = module.get(St8BonusService);
    adminRepository = module.get(getRepositoryToken(AdminEntity));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create bonus with valid admin ID', async () => {
      adminRepository.findOne.mockResolvedValue(mockAdmin);
      service.createBonus.mockResolvedValue(mockSt8Response);

      const result = await controller.create(mockBonusData, mockAdminId);

      expect(adminRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockAdminId },
      });
      expect(service.createBonus).toHaveBeenCalledWith(mockBonusData, mockAdminId);
      expect(result).toEqual(mockSt8Response);
    });

    it('should throw BadRequestException when admin ID is missing', async () => {
      await expect(controller.create(mockBonusData, undefined)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.create(mockBonusData, undefined)).rejects.toThrow(
        'Admin ID required (x-admin-id header)',
      );

      expect(adminRepository.findOne).not.toHaveBeenCalled();
      expect(service.createBonus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when admin does not exist', async () => {
      adminRepository.findOne.mockResolvedValue(null);

      await expect(controller.create(mockBonusData, 'non-existent-admin')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.create(mockBonusData, 'non-existent-admin')).rejects.toThrow(
        'Admin non-existent-admin not found',
      );

      expect(adminRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'non-existent-admin' },
      });
      expect(service.createBonus).not.toHaveBeenCalled();
    });

    it('should pass validated DTO to service', async () => {
      adminRepository.findOne.mockResolvedValue(mockAdmin);
      service.createBonus.mockResolvedValue(mockSt8Response);

      await controller.create(mockBonusData, mockAdminId);

      expect(service.createBonus).toHaveBeenCalledWith(mockBonusData, mockAdminId);
    });
  });

  describe('getOffers', () => {
    it('should fetch offers from service', async () => {
      const offers = { status: 'ok', offers: [] };
      service.getOffers.mockResolvedValue(offers);

      const result = await controller.getOffers('game1,game2', 'USD', 'free_money', 'site1');

      expect(service.getOffers).toHaveBeenCalledWith({
        game_codes: ['game1', 'game2'],
        currency: 'USD',
        type: 'free_money',
        site: 'site1',
      });
      expect(result).toEqual(offers);
    });

    it('should handle undefined query parameters', async () => {
      const offers = { status: 'ok', offers: [] };
      service.getOffers.mockResolvedValue(offers);

      const result = await controller.getOffers(undefined, undefined, undefined, undefined);

      expect(service.getOffers).toHaveBeenCalledWith({
        game_codes: undefined,
        currency: undefined,
        type: undefined,
        site: undefined,
      });
      expect(result).toEqual(offers);
    });

    it('should parse comma-separated game codes', async () => {
      service.getOffers.mockResolvedValue({ status: 'ok', offers: [] });

      await controller.getOffers('game1, game2 , game3', 'USD', undefined, undefined);

      expect(service.getOffers).toHaveBeenCalledWith({
        game_codes: ['game1', 'game2', 'game3'],
        currency: 'USD',
        type: undefined,
        site: undefined,
      });
    });
  });

  describe('getLocalBonuses', () => {
    it('should fetch local bonuses with all filters', async () => {
      const bonuses = [];
      service.getLocalBonuses.mockResolvedValue(bonuses);

      const result = await controller.getLocalBonuses(
        'game1',
        'free_money',
        'USD',
        'finished',
        mockAdminId,
        10,
        20,
      );

      expect(service.getLocalBonuses).toHaveBeenCalledWith({
        gameCode: 'game1',
        type: 'free_money',
        currency: 'USD',
        status: 'finished',
        createdByAdminId: mockAdminId,
        limit: 10,
        offset: 20,
      });
      expect(result).toEqual(bonuses);
    });

    it('should handle undefined query parameters', async () => {
      const bonuses = [];
      service.getLocalBonuses.mockResolvedValue(bonuses);

      const result = await controller.getLocalBonuses(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      expect(service.getLocalBonuses).toHaveBeenCalledWith({
        gameCode: undefined,
        type: undefined,
        currency: undefined,
        status: undefined,
        createdByAdminId: undefined,
        limit: undefined,
        offset: undefined,
      });
      expect(result).toEqual(bonuses);
    });

    it('should parse limit and offset as numbers', async () => {
      service.getLocalBonuses.mockResolvedValue([]);

      await controller.getLocalBonuses(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        5,
        10,
      );

      expect(service.getLocalBonuses).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5,
          offset: 10,
        }),
      );
    });
  });

  describe('fetch', () => {
    it('should fetch bonus and update status', async () => {
      service.fetchBonus.mockResolvedValue(mockSt8Response);
      service.updateBonusStatusFromSt8.mockResolvedValue();

      const result = await controller.fetch('bonus-123', 'site1');

      expect(service.fetchBonus).toHaveBeenCalledWith('bonus-123', 'site1');
      expect(service.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-123', 'site1');
      expect(result).toEqual(mockSt8Response);
    });

    it('should handle status update errors gracefully', async () => {
      const updateError = new Error('Status update failed');
      service.fetchBonus.mockResolvedValue(mockSt8Response);
      service.updateBonusStatusFromSt8.mockRejectedValue(updateError);

      const result = await controller.fetch('bonus-123', 'site1');

      expect(service.fetchBonus).toHaveBeenCalledWith('bonus-123', 'site1');
      expect(service.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-123', 'site1');
      expect(result).toEqual(mockSt8Response);
    });

    it('should handle undefined site parameter', async () => {
      service.fetchBonus.mockResolvedValue(mockSt8Response);
      service.updateBonusStatusFromSt8.mockResolvedValue();

      await controller.fetch('bonus-123', undefined);

      expect(service.fetchBonus).toHaveBeenCalledWith('bonus-123', undefined);
      expect(service.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-123', undefined);
    });
  });

  describe('cancel', () => {
    it('should cancel bonus successfully', async () => {
      const cancelResponse: ISt8BonusResponse = {
        status: 'ok',
        bonus: {
          bonus_id: 'bonus-123',
          status: 'canceled',
        },
      };

      service.cancelBonus.mockResolvedValue(cancelResponse);

      const result = await controller.cancel('bonus-123', {
        site: 'site1',
        players: ['player1'],
      });

      expect(service.cancelBonus).toHaveBeenCalledWith({
        bonus_id: 'bonus-123',
        site: 'site1',
        players: ['player1'],
      });
      expect(result).toEqual(cancelResponse);
    });

    it('should handle cancel without optional body parameters', async () => {
      service.cancelBonus.mockResolvedValue(mockSt8Response);

      await controller.cancel('bonus-123', {});

      expect(service.cancelBonus).toHaveBeenCalledWith({
        bonus_id: 'bonus-123',
        site: undefined,
        players: undefined,
      });
    });
  });
});
