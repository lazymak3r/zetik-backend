import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { createTestProviders } from '../../../test-utils';
import { BonusSchedulerService } from '../bonus-scheduler.service';

describe('BonusSchedulerService', () => {
  let service: BonusSchedulerService;
  let mockQueue: jest.Mocked<Partial<Queue>>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: BonusSchedulerService,
          useFactory: () => new BonusSchedulerService(mockQueue as Queue),
        },
      ],
    }).compile();

    service = module.get<BonusSchedulerService>(BonusSchedulerService);
  });

  describe('triggerDailyBonuses', () => {
    it('should schedule manual daily bonus job', async () => {
      // Arrange
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-1' });

      // Act
      const result = await service.triggerDailyBonuses();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Daily bonus processing triggered',
        jobId: 'job-1',
      });
      expect(mockQueue.add).toHaveBeenCalledWith('scheduleDailyBonuses', {});
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      (mockQueue.add as jest.Mock).mockRejectedValue(new Error('Queue error'));

      // Act
      const result = await service.triggerDailyBonuses();

      // Assert
      expect(result).toEqual({
        success: false,
        message: 'Failed to trigger daily bonuses: Queue error',
      });
    });
  });

  describe('triggerWeeklyBonuses', () => {
    it('should schedule manual weekly bonus job', async () => {
      // Arrange
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-2' });

      // Act
      const result = await service.triggerWeeklyBonuses();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Weekly bonus processing triggered',
        jobId: 'job-2',
      });
      expect(mockQueue.add).toHaveBeenCalledWith('scheduleWeeklyBonuses', {});
    });
  });

  describe('triggerMonthlyBonuses', () => {
    it('should schedule manual monthly bonus job', async () => {
      // Arrange
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-3' });

      // Act
      const result = await service.triggerMonthlyBonuses();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Monthly bonus processing triggered',
        jobId: 'job-3',
      });
      expect(mockQueue.add).toHaveBeenCalledWith('scheduleMonthlyBonuses', {});
    });
  });

  describe('triggerBonusExpiration', () => {
    it('should schedule manual bonus expiration job', async () => {
      // Arrange
      (mockQueue.add as jest.Mock).mockResolvedValue({ id: 'job-4' });

      // Act
      const result = await service.triggerBonusExpiration();

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Bonus expiration processing triggered',
        jobId: 'job-4',
      });
      expect(mockQueue.add).toHaveBeenCalledWith('expireBonuses', {});
    });
  });
});
