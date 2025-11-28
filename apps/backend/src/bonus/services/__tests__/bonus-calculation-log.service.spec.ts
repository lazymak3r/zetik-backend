import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  BonusCalculationLogEntity,
  BonusCalculationStatusEnum,
  BonusJobTypeEnum,
} from '@zetik/shared-entities';
import { createTestProviders } from '../../../test-utils';
import { BonusCalculationLogService } from '../bonus-calculation-log.service';

describe('BonusCalculationLogService', () => {
  let service: BonusCalculationLogService;
  let repository: jest.Mocked<Repository<BonusCalculationLogEntity>>;

  const mockLog: BonusCalculationLogEntity = {
    id: 'log-1',
    jobId: 'job-1',
    jobType: BonusJobTypeEnum.DAILY_BONUS,
    periodFrom: new Date('2024-01-01'),
    periodTo: new Date('2024-01-02'),
    status: BonusCalculationStatusEnum.PENDING,
    usersProcessed: 0,
    usersFailed: 0,
    totalBonusAmount: '0',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BonusCalculationLogService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(BonusCalculationLogEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<BonusCalculationLogService>(BonusCalculationLogService);
    repository = module.get(getRepositoryToken(BonusCalculationLogEntity));
  });

  describe('createJobLogAtomic', () => {
    it('should create new job log successfully', async () => {
      // Arrange
      repository.create.mockReturnValue(mockLog);
      repository.save.mockResolvedValue(mockLog);

      // Act
      const result = await service.createJobLogAtomic(
        'job-1',
        BonusJobTypeEnum.DAILY_BONUS,
        new Date('2024-01-01'),
        new Date('2024-01-02'),
        { test: 'metadata' },
      );

      // Assert
      expect(result.created).toBe(true);
      expect(result.log).toBe(mockLog);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          jobType: BonusJobTypeEnum.DAILY_BONUS,
          status: BonusCalculationStatusEnum.PENDING,
          metadata: { test: 'metadata' },
        }),
      );
      expect(repository.save).toHaveBeenCalledWith(mockLog);
    });

    it('should handle duplicate key error and return existing completed job', async () => {
      // Arrange
      const duplicateError = { code: '23505' }; // PostgreSQL unique constraint violation
      repository.create.mockReturnValue(mockLog);
      repository.save.mockRejectedValue(duplicateError);

      const existingLog = {
        ...mockLog,
        id: 'existing-log',
        status: BonusCalculationStatusEnum.COMPLETED,
      };
      repository.findOne.mockResolvedValue(existingLog);

      // Act
      const result = await service.createJobLogAtomic(
        'job-1',
        BonusJobTypeEnum.DAILY_BONUS,
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );

      // Assert
      expect(result.created).toBe(false);
      expect(result.log).toBe(existingLog);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          jobType: BonusJobTypeEnum.DAILY_BONUS,
          periodFrom: new Date('2024-01-01'),
          periodTo: new Date('2024-01-02'),
        },
        order: { createdAt: 'DESC' },
      });
    });

    it('should handle duplicate key error with existing running job', async () => {
      // Arrange
      const duplicateError = { message: 'duplicate key error' };
      repository.create.mockReturnValue(mockLog);
      repository.save.mockRejectedValue(duplicateError);

      const existingLog = {
        ...mockLog,
        id: 'existing-log',
        status: BonusCalculationStatusEnum.RUNNING,
      };
      repository.findOne.mockResolvedValue(existingLog);

      // Act
      const result = await service.createJobLogAtomic(
        'job-1',
        BonusJobTypeEnum.DAILY_BONUS,
        new Date('2024-01-01'),
        new Date('2024-01-02'),
      );

      // Assert
      expect(result.created).toBe(false);
      expect(result.log).toBe(existingLog);
    });

    it('should throw error if not a duplicate key error', async () => {
      // Arrange
      const unknownError = new Error('Database connection failed');
      repository.create.mockReturnValue(mockLog);
      repository.save.mockRejectedValue(unknownError);

      // Act & Assert
      await expect(
        service.createJobLogAtomic(
          'job-1',
          BonusJobTypeEnum.DAILY_BONUS,
          new Date('2024-01-01'),
          new Date('2024-01-02'),
        ),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status with timestamps', async () => {
      // Arrange
      const jobId = 'job-1';
      const status = BonusCalculationStatusEnum.RUNNING;

      // Act
      await service.updateJobStatus(jobId, status);

      // Assert
      expect(repository.update).toHaveBeenCalledWith(
        { jobId },
        expect.objectContaining({
          status,
          startedAt: expect.any(Date),
        }),
      );
    });

    it('should set completion timestamp for completed status', async () => {
      // Arrange
      const jobId = 'job-1';
      const status = BonusCalculationStatusEnum.COMPLETED;

      // Act
      await service.updateJobStatus(jobId, status);

      // Assert
      expect(repository.update).toHaveBeenCalledWith(
        { jobId },
        expect.objectContaining({
          status,
          completedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('getJobStats', () => {
    it('should calculate job statistics correctly', async () => {
      // Arrange
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              ...mockLog,
              status: BonusCalculationStatusEnum.COMPLETED,
              usersProcessed: 10,
              totalBonusAmount: '100',
            },
            {
              ...mockLog,
              status: BonusCalculationStatusEnum.FAILED,
              usersProcessed: 5,
              totalBonusAmount: '50',
            },
          ],
          2,
        ]),
      } as any;
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getJobStats();

      // Assert
      expect(result).toEqual({
        totalJobs: 2,
        completedJobs: 1,
        failedJobs: 1,
        totalUsersProcessed: 15,
        totalBonusDistributed: '150',
      });
    });
  });
});
