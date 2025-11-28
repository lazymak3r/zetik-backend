import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { BonusesService } from './bonuses.service';
import { CancelBonusesDto } from './dto/cancel-bonuses.dto';
import { GetBonusesFilterDto } from './dto/get-bonuses-filter.dto';

describe('BonusesService', () => {
  let service: BonusesService;

  const mockRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonusesService,
        {
          provide: getRepositoryToken(BonusTransactionEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BonusesService>(BonusesService);

    // Reset mocks
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getBonusesWithFilters', () => {
    it('should return filtered bonuses with pagination', async () => {
      const filters: GetBonusesFilterDto = {
        page: 1,
        limit: 10,
        status: ['PENDING'],
        bonusType: ['LEVEL_UP'],
        userId: 'user-123',
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      };

      const mockBonuses = [
        {
          id: 'bonus-1',
          status: BonusTransactionStatusEnum.PENDING,
          bonusType: BonusTypeEnum.LEVEL_UP,
          amount: '2500',
          userId: 'user-123',
        },
      ];

      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue(mockBonuses);

      const result = await service.getBonusesWithFilters(filters);

      expect(result).toEqual({
        bonuses: mockBonuses,
        total: 1,
      });

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('bonus');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('bonus.status IN (:...statuses)', {
        statuses: ['PENDING'],
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('bonus.bonusType IN (:...types)', {
        types: ['LEVEL_UP'],
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('bonus.userId = :userId', {
        userId: 'user-123',
      });
    });

    it('should handle empty filters', async () => {
      const filters: GetBonusesFilterDto = {
        page: 1,
        limit: 20,
      };

      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.getBonusesWithFilters(filters);

      expect(result).toEqual({
        bonuses: [],
        total: 0,
      });

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('cancelBonusesBatch', () => {
    it('should cancel multiple bonuses successfully', async () => {
      const dto: CancelBonusesDto = {
        bonusIds: ['bonus-1', 'bonus-2'],
        reason: 'Test cancellation',
      };
      const adminId = 'admin-123';

      const mockBonuses = [
        {
          id: 'bonus-1',
          status: BonusTransactionStatusEnum.PENDING,
          metadata: {},
        },
        {
          id: 'bonus-2',
          status: BonusTransactionStatusEnum.PENDING,
          metadata: {},
        },
      ];

      mockRepository.findOne
        .mockResolvedValueOnce(mockBonuses[0])
        .mockResolvedValueOnce(mockBonuses[1]);

      mockRepository.save.mockResolvedValue({});

      const result = await service.cancelBonusesBatch(dto, adminId);

      expect(result).toEqual({
        success: 2,
        failed: [],
        total: 2,
      });

      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);

      // Verify bonus was updated correctly
      expect(mockBonuses[0].status).toBe(BonusTransactionStatusEnum.CANCELED);
      expect(mockBonuses[0].metadata).toEqual({
        cancellationReason: 'Test cancellation',
        canceledAt: expect.any(String),
        originalStatus: BonusTransactionStatusEnum.PENDING,
        canceledBy: adminId,
      });
    });

    it('should handle non-existent bonuses', async () => {
      const dto: CancelBonusesDto = {
        bonusIds: ['non-existent'],
        reason: 'Test',
      };
      const adminId = 'admin-123';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.cancelBonusesBatch(dto, adminId);

      expect(result).toEqual({
        success: 0,
        failed: ['non-existent'],
        total: 1,
      });
    });

    it('should handle database errors gracefully', async () => {
      const dto: CancelBonusesDto = {
        bonusIds: ['bonus-1'],
        reason: 'Test',
      };
      const adminId = 'admin-123';

      mockRepository.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.cancelBonusesBatch(dto, adminId);

      expect(result).toEqual({
        success: 0,
        failed: ['bonus-1'],
        total: 1,
      });
    });
  });
});
