import { St8BonusEntity, St8BonusStatusEnum } from '@zetik/shared-entities';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { St8BonusSchedulerService } from './st8-bonus-scheduler.service';
import { St8BonusService } from './st8-bonus.service';

describe('St8BonusSchedulerService', () => {
  let service: St8BonusSchedulerService;
  let st8BonusRepository: jest.Mocked<Repository<St8BonusEntity>>;
  let st8BonusService: jest.Mocked<St8BonusService>;

  const mockBonus: St8BonusEntity = {
    bonus_id: 'bonus-123',
    gameCodes: ['game1'],
    type: 'free_money' as any,
    value: '100.00',
    currency: 'USD',
    players: ['player1'],
    status: St8BonusStatusEnum.PROCESSING,
    createdByAdminId: 'admin-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as St8BonusEntity;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        St8BonusSchedulerService,
        {
          provide: getRepositoryToken(St8BonusEntity),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: St8BonusService,
          useValue: {
            updateBonusStatusFromSt8: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<St8BonusSchedulerService>(St8BonusSchedulerService);
    st8BonusRepository = module.get(getRepositoryToken(St8BonusEntity));
    st8BonusService = module.get(St8BonusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkProcessingBonuses', () => {
    it('should process no bonuses when list is empty', async () => {
      st8BonusRepository.find.mockResolvedValue([]);

      await service.checkProcessingBonuses();

      expect(st8BonusRepository.find).toHaveBeenCalledWith({
        where: {
          status: St8BonusStatusEnum.PROCESSING,
        },
      });
      expect(st8BonusService.updateBonusStatusFromSt8).not.toHaveBeenCalled();
    });

    it('should process single bonus', async () => {
      st8BonusRepository.find.mockResolvedValue([mockBonus]);
      st8BonusService.updateBonusStatusFromSt8.mockResolvedValue();

      await service.checkProcessingBonuses();

      expect(st8BonusRepository.find).toHaveBeenCalledWith({
        where: {
          status: St8BonusStatusEnum.PROCESSING,
        },
      });
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-123', undefined);
    });

    it('should process bonuses in batches of 10', async () => {
      const bonuses = Array.from({ length: 25 }, (_, i) => ({
        ...mockBonus,
        bonus_id: `bonus-${i}`,
      }));

      st8BonusRepository.find.mockResolvedValue(bonuses);
      st8BonusService.updateBonusStatusFromSt8.mockResolvedValue();

      await service.checkProcessingBonuses();

      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledTimes(25);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-0', undefined);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-9', undefined);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-10', undefined);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-24', undefined);
    });

    it('should handle errors for individual bonuses without stopping batch', async () => {
      const bonuses = [
        { ...mockBonus, bonus_id: 'bonus-1' },
        { ...mockBonus, bonus_id: 'bonus-2' },
        { ...mockBonus, bonus_id: 'bonus-3' },
      ];

      st8BonusRepository.find.mockResolvedValue(bonuses);
      st8BonusService.updateBonusStatusFromSt8
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce();

      await service.checkProcessingBonuses();

      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledTimes(3);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-1', undefined);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-2', undefined);
      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-3', undefined);
    });

    it('should process bonuses with site parameter', async () => {
      const bonusWithSite = {
        ...mockBonus,
        site: 'site1',
      };

      st8BonusRepository.find.mockResolvedValue([bonusWithSite]);
      st8BonusService.updateBonusStatusFromSt8.mockResolvedValue();

      await service.checkProcessingBonuses();

      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledWith('bonus-123', 'site1');
    });

    it('should handle errors gracefully', async () => {
      const repositoryError = new Error('Database error');
      st8BonusRepository.find.mockRejectedValue(repositoryError);

      await expect(service.checkProcessingBonuses()).resolves.not.toThrow();

      expect(st8BonusService.updateBonusStatusFromSt8).not.toHaveBeenCalled();
    });

    it('should process exactly 10 bonuses in one batch', async () => {
      const bonuses = Array.from({ length: 10 }, (_, i) => ({
        ...mockBonus,
        bonus_id: `bonus-${i}`,
      }));

      st8BonusRepository.find.mockResolvedValue(bonuses);
      st8BonusService.updateBonusStatusFromSt8.mockResolvedValue();

      await service.checkProcessingBonuses();

      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledTimes(10);
    });

    it('should process 11 bonuses in two batches', async () => {
      const bonuses = Array.from({ length: 11 }, (_, i) => ({
        ...mockBonus,
        bonus_id: `bonus-${i}`,
      }));

      st8BonusRepository.find.mockResolvedValue(bonuses);
      st8BonusService.updateBonusStatusFromSt8.mockResolvedValue();

      await service.checkProcessingBonuses();

      expect(st8BonusService.updateBonusStatusFromSt8).toHaveBeenCalledTimes(11);
    });
  });
});
