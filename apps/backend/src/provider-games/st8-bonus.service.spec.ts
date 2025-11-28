import { St8BonusEntity, St8BonusStatusEnum, St8BonusTypeEnum } from '@zetik/shared-entities';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ISt8BonusResponse, ISt8CreateBonusParams } from './interfaces/st8-types.interface';
import { St8ApiClient } from './st8-api-client.service';
import { St8BonusService } from './st8-bonus.service';

describe('St8BonusService', () => {
  let service: St8BonusService;
  let st8BonusRepository: jest.Mocked<Repository<St8BonusEntity>>;
  let st8ApiClient: jest.Mocked<St8ApiClient>;

  const mockAdminId = 'admin-123';
  const mockBonusId = 'bonus-test-12345';
  const mockBonusData: ISt8CreateBonusParams = {
    bonus_id: mockBonusId,
    game_codes: ['game1', 'game2'],
    currency: 'USD',
    value: '100.00',
    type: 'free_money' as any,
    players: ['player1', 'player2'],
    count: 1,
    site: 'site1',
  };

  const mockSt8Response: ISt8BonusResponse = {
    status: 'ok',
    bonus: {
      bonus_id: mockBonusId,
      status: 'finished',
      instances: [
        {
          instance_id: 'instance1',
          player: 'player1',
          status: 'finished',
          start_time: '2025-01-01T00:00:00Z',
          end_time: '2025-01-01T01:00:00Z',
        },
      ],
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        St8BonusService,
        {
          provide: getRepositoryToken(St8BonusEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: St8ApiClient,
          useValue: {
            getOffers: jest.fn(),
            createBonus: jest.fn(),
            getBonus: jest.fn(),
            cancelBonus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<St8BonusService>(St8BonusService);
    st8BonusRepository = module.get(getRepositoryToken(St8BonusEntity));
    st8ApiClient = module.get(St8ApiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBonus', () => {
    it('should successfully create bonus', async () => {
      st8BonusRepository.findOne.mockResolvedValue(null);
      st8BonusRepository.save.mockResolvedValue({
        bonus_id: mockBonusId,
        gameCodes: mockBonusData.game_codes,
        type: St8BonusTypeEnum.FREE_MONEY,
        value: mockBonusData.value,
        currency: mockBonusData.currency,
        players: mockBonusData.players,
        count: mockBonusData.count,
        site: mockBonusData.site,
        startTime: undefined,
        duration: undefined,
        createdByAdminId: mockAdminId,
        status: St8BonusStatusEnum.PROCESSING,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as St8BonusEntity);
      st8ApiClient.createBonus.mockResolvedValue(mockSt8Response);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.createBonus(mockBonusData, mockAdminId);

      expect(st8BonusRepository.findOne).toHaveBeenCalledWith({
        where: { bonus_id: mockBonusId },
      });
      expect(st8BonusRepository.save).toHaveBeenCalled();
      expect(st8ApiClient.createBonus).toHaveBeenCalledWith(mockBonusData, mockBonusData.currency);
      expect(st8BonusRepository.update).toHaveBeenCalledWith(
        { bonus_id: mockBonusId },
        { status: St8BonusStatusEnum.FINISHED },
      );
      expect(result).toEqual(mockSt8Response);
    });

    it('should throw ConflictException if bonus_id already exists', async () => {
      st8BonusRepository.findOne.mockResolvedValue({
        bonus_id: mockBonusId,
      } as St8BonusEntity);

      await expect(service.createBonus(mockBonusData, mockAdminId)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createBonus(mockBonusData, mockAdminId)).rejects.toThrow(
        'Bonus ID already exists',
      );

      expect(st8BonusRepository.findOne).toHaveBeenCalledWith({
        where: { bonus_id: mockBonusId },
      });
      expect(st8BonusRepository.save).not.toHaveBeenCalled();
      expect(st8ApiClient.createBonus).not.toHaveBeenCalled();
    });

    it('should handle ST8 API error and mark bonus as ERROR', async () => {
      st8BonusRepository.findOne.mockResolvedValue(null);
      st8BonusRepository.save.mockResolvedValue({
        bonus_id: mockBonusId,
        status: St8BonusStatusEnum.PROCESSING,
      } as St8BonusEntity);
      const apiError = new Error('ST8 API error');
      st8ApiClient.createBonus.mockRejectedValue(apiError);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      await expect(service.createBonus(mockBonusData, mockAdminId)).rejects.toThrow(apiError);

      expect(st8BonusRepository.save).toHaveBeenCalled();
      expect(st8ApiClient.createBonus).toHaveBeenCalled();
      expect(st8BonusRepository.update).toHaveBeenCalledWith(
        { bonus_id: mockBonusId },
        { status: St8BonusStatusEnum.ERROR },
      );
    });

    it('should create bonus with start_time', async () => {
      const startTime = '2025-01-01T12:00:00Z';
      const bonusDataWithTime = {
        ...mockBonusData,
        start_time: startTime,
      };

      st8BonusRepository.findOne.mockResolvedValue(null);
      st8BonusRepository.save.mockResolvedValue({
        bonus_id: mockBonusId,
        startTime: new Date(startTime),
        status: St8BonusStatusEnum.PROCESSING,
      } as St8BonusEntity);
      st8ApiClient.createBonus.mockResolvedValue(mockSt8Response);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.createBonus(bonusDataWithTime, mockAdminId);

      expect(st8BonusRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: new Date(startTime),
        }),
      );
    });
  });

  describe('fetchBonus', () => {
    it('should fetch bonus from ST8 API', async () => {
      st8ApiClient.getBonus.mockResolvedValue(mockSt8Response);

      const result = await service.fetchBonus(mockBonusId, 'site1');

      expect(st8ApiClient.getBonus).toHaveBeenCalledWith(mockBonusId, 'site1');
      expect(result).toEqual(mockSt8Response);
    });
  });

  describe('updateBonusStatusFromSt8', () => {
    it('should update bonus status from ST8 response', async () => {
      const st8Response = {
        status: 'ok',
        bonus: {
          bonus_id: mockBonusId,
          status: 'finished',
        },
      };

      st8ApiClient.getBonus.mockResolvedValue(st8Response as any);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateBonusStatusFromSt8(mockBonusId, 'site1');

      expect(st8ApiClient.getBonus).toHaveBeenCalledWith(mockBonusId, 'site1');
      expect(st8BonusRepository.update).toHaveBeenCalledWith(
        { bonus_id: mockBonusId },
        { status: St8BonusStatusEnum.FINISHED },
      );
    });

    it('should handle ST8 API error', async () => {
      const apiError = new Error('ST8 API error');
      st8ApiClient.getBonus.mockRejectedValue(apiError);

      await expect(service.updateBonusStatusFromSt8(mockBonusId)).rejects.toThrow(apiError);
      expect(st8BonusRepository.update).not.toHaveBeenCalled();
    });

    it('should handle missing status in response', async () => {
      const st8Response = {
        status: 'ok',
        bonus: {
          bonus_id: mockBonusId,
        },
      };

      st8ApiClient.getBonus.mockResolvedValue(st8Response as any);

      await service.updateBonusStatusFromSt8(mockBonusId);

      expect(st8BonusRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('cancelBonus', () => {
    it('should successfully cancel bonus', async () => {
      const cancelResponse: ISt8BonusResponse = {
        status: 'ok',
        bonus: {
          bonus_id: mockBonusId,
          status: 'canceled',
          instances: [
            {
              instance_id: 'instance1',
              player: 'player1',
              status: 'canceled',
              start_time: '2025-01-01T00:00:00Z',
              end_time: '2025-01-01T01:00:00Z',
            },
            {
              instance_id: 'instance2',
              player: 'player2',
              status: 'finished',
              start_time: '2025-01-01T00:00:00Z',
              end_time: '2025-01-01T01:00:00Z',
            },
          ],
        },
      };

      st8ApiClient.cancelBonus.mockResolvedValue(cancelResponse);
      st8BonusRepository.findOne.mockResolvedValue({
        bonus_id: mockBonusId,
        players: ['player1', 'player2'],
      } as St8BonusEntity);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.cancelBonus({
        bonus_id: mockBonusId,
        site: 'site1',
        players: ['player1'],
      });

      expect(st8ApiClient.cancelBonus).toHaveBeenCalledWith({
        bonus_id: mockBonusId,
        site: 'site1',
        players: ['player1'],
      });
      expect(st8BonusRepository.findOne).toHaveBeenCalledWith({
        where: { bonus_id: mockBonusId },
      });
      expect(st8BonusRepository.update).toHaveBeenCalledWith(
        { bonus_id: mockBonusId },
        {
          players: ['player2'],
          status: St8BonusStatusEnum.CANCELED,
        },
      );
      expect(result).toEqual(cancelResponse);
    });

    it('should throw error if bonus not found', async () => {
      st8ApiClient.cancelBonus.mockResolvedValue(mockSt8Response);
      st8BonusRepository.findOne.mockResolvedValue(null);

      await expect(
        service.cancelBonus({
          bonus_id: mockBonusId,
        }),
      ).rejects.toThrow(`Bonus ${mockBonusId} not found`);
    });

    it('should handle empty instances array', async () => {
      const cancelResponse: ISt8BonusResponse = {
        status: 'ok',
        bonus: {
          bonus_id: mockBonusId,
          status: 'canceled',
        },
      };

      st8ApiClient.cancelBonus.mockResolvedValue(cancelResponse);
      st8BonusRepository.findOne.mockResolvedValue({
        bonus_id: mockBonusId,
      } as St8BonusEntity);
      st8BonusRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancelBonus({
        bonus_id: mockBonusId,
      });

      expect(st8BonusRepository.update).toHaveBeenCalledWith(
        { bonus_id: mockBonusId },
        {
          players: [],
          status: St8BonusStatusEnum.CANCELED,
        },
      );
    });
  });

  describe('getLocalBonuses', () => {
    it('should filter bonuses by gameCode', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        gameCode: 'game1',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalled();
      expect(queryBuilder.getMany).toHaveBeenCalled();
    });

    it('should filter bonuses by type', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        type: St8BonusTypeEnum.FREE_MONEY,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('bonus.type = :type', {
        type: St8BonusTypeEnum.FREE_MONEY,
      });
    });

    it('should filter bonuses by currency', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        currency: 'USD',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('bonus.currency ILIKE :currency', {
        currency: '%USD%',
      });
    });

    it('should filter bonuses by createdByAdminId', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        createdByAdminId: mockAdminId,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'bonus.createdByAdminId = :createdByAdminId',
        { createdByAdminId: mockAdminId },
      );
    });

    it('should filter bonuses by status', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        status: St8BonusStatusEnum.PROCESSING,
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('bonus.status = :status', {
        status: St8BonusStatusEnum.PROCESSING,
      });
    });

    it('should apply pagination with limit and offset', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({
        limit: 10,
        offset: 20,
      });

      expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      expect(queryBuilder.offset).toHaveBeenCalledWith(20);
    });

    it('should return all bonuses when no filters provided', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      st8BonusRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      await service.getLocalBonuses({});

      expect(queryBuilder.getMany).toHaveBeenCalled();
    });
  });

  describe('getOffers', () => {
    it('should fetch offers from ST8 API', async () => {
      const offers = {
        status: 'ok',
        offers: [],
      };

      st8ApiClient.getOffers.mockResolvedValue(offers);

      const result = await service.getOffers({
        game_codes: ['game1'],
        currency: 'USD',
        type: 'free_money',
        site: 'site1',
      });

      expect(st8ApiClient.getOffers).toHaveBeenCalledWith(
        {
          game_codes: ['game1'],
          currency: 'USD',
          type: 'free_money',
          site: 'site1',
        },
        'USD',
      );
      expect(result).toEqual(offers);
    });
  });
});
