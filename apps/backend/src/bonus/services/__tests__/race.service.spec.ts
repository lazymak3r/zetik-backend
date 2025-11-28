import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  RaceEntity,
  RaceParticipantEntity,
  RaceStatusEnum,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { RedisService } from '../../../common/services/redis.service';
import { createTestProviders } from '../../../test-utils/common-providers';
import { RaceService } from '../race.service';

describe('RaceService', () => {
  let service: RaceService;
  let mockRaceRepo: jest.Mocked<Repository<RaceEntity>>;
  let mockParticipantRepo: jest.Mocked<Repository<RaceParticipantEntity>>;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
      })),
    };

    const mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setNX: jest.fn(),
      delete: jest.fn(),
      getClient: jest.fn(() => ({
        zscore: jest.fn(),
        zrevrank: jest.fn(),
        pipeline: jest.fn(() => ({
          srem: jest.fn(),
          exec: jest.fn(),
        })),
      })),
    };

    const mockEvents = {
      emit: jest.fn(),
      emitAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RaceService,
        ...createTestProviders(),
        {
          provide: getRepositoryToken(RaceEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(RaceParticipantEntity),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(WeeklyRacePrizeEntity),
          useValue: mockRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
        {
          provide: EventEmitter2,
          useValue: mockEvents,
        },
      ],
    }).compile();

    service = module.get<RaceService>(RaceService);
    mockRaceRepo = module.get(getRepositoryToken(RaceEntity));
    mockParticipantRepo = module.get(getRepositoryToken(RaceParticipantEntity));
    mockRedisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should not throw if ensureWeeklyRaceExists fails', async () => {
      // Mock findOne to throw error
      mockRaceRepo.findOne.mockRejectedValue(new Error('Database connection error'));

      // Should not throw
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });

    it('should log error if weekly race creation fails', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      mockRaceRepo.findOne.mockRejectedValue(new Error('Database error'));

      await service.onModuleInit();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Failed to ensure weekly race exists on startup:',
        expect.any(Error),
      );
    });
  });

  describe('getUserRaceStats', () => {
    const userId = 'user-123';
    const raceId = 'race-456';

    it('should use ZREVRANK for deterministic user placement', async () => {
      const mockClient: any = {
        zscore: jest.fn().mockResolvedValue('1000'),
        zrevrank: jest.fn().mockResolvedValue(2), // User is 3rd place (0-indexed)
      };

      mockRedisService.getClient.mockReturnValue(mockClient);
      mockRaceRepo.findOne.mockResolvedValue({
        id: raceId,
        status: RaceStatusEnum.ACTIVE,
        prizes: [100, 50, 25],
      } as RaceEntity);

      const result = await service.getUserRaceStats(userId, raceId);

      expect(mockClient.zrevrank).toHaveBeenCalledWith(`race:wagers:${raceId}`, userId);
      expect(result).toBeDefined();
      expect(result?.place).toBe(3); // rank 2 + 1 = place 3
    });

    it('should return null if user not participating', async () => {
      const mockClient: any = {
        zscore: jest.fn().mockResolvedValue(null),
        zrevrank: jest.fn().mockResolvedValue(null),
      };

      mockRedisService.getClient.mockReturnValue(mockClient);
      mockRaceRepo.findOne.mockResolvedValue({
        id: raceId,
        status: RaceStatusEnum.ACTIVE,
      } as RaceEntity);

      const result = await service.getUserRaceStats(userId, raceId);

      expect(result).toBeNull();
    });

    it('should handle tied scores consistently', async () => {
      // ZREVRANK provides stable ordering even with ties
      const mockClient: any = {
        zscore: jest.fn().mockResolvedValue('500'), // Tied score
        zrevrank: jest.fn().mockResolvedValue(5), // Deterministic rank
      };

      mockRedisService.getClient.mockReturnValue(mockClient);
      mockRaceRepo.findOne.mockResolvedValue({
        id: raceId,
        status: RaceStatusEnum.ACTIVE,
        prizes: [100, 50, 25, 10, 5],
      } as RaceEntity);

      const result = await service.getUserRaceStats(userId, raceId);

      expect(result?.place).toBe(6); // rank 5 + 1
      expect(mockClient.zrevrank).toHaveBeenCalled();
    });

    it('should throw NotFoundException if race does not exist', async () => {
      mockRaceRepo.findOne.mockResolvedValue(null);

      await expect(service.getUserRaceStats(userId, raceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addUserToActiveRaces', () => {
    const userId = 'user-789';

    it('should batch upsert participants to avoid N+1 queries', async () => {
      const mockRaces = Array.from({ length: 10 }, (_, i) => ({
        id: `race-${i}`,
        referralCode: 'TEST',
      }));

      mockRaceRepo.find.mockResolvedValue(mockRaces as RaceEntity[]);

      const mockPipeline: any = {
        sadd: jest.fn(),
        exec: jest.fn(),
      };

      mockRedisService.getClient.mockReturnValue({
        pipeline: jest.fn(() => mockPipeline),
      } as any);

      await service.addUserToActiveRaces(userId);

      // Should call upsert once with all participants
      expect(mockParticipantRepo.save).toHaveBeenCalledTimes(1);
      expect(mockParticipantRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId,
            raceId: expect.any(String),
          }),
        ]),
      );

      // Should use Redis pipeline
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(mockPipeline.sadd).toHaveBeenCalledTimes(10);
    });

    it('should handle empty race list gracefully', async () => {
      mockRaceRepo.find.mockResolvedValue([]);

      await expect(service.addUserToActiveRaces(userId)).resolves.not.toThrow();

      expect(mockParticipantRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('generateUniqueSlug', () => {
    it('should generate unique slug when conflicts exist', async () => {
      mockRaceRepo.findOne
        .mockResolvedValueOnce({ id: '1' } as RaceEntity) // First attempt conflicts
        .mockResolvedValueOnce({ id: '2' } as RaceEntity) // Second attempt conflicts
        .mockResolvedValueOnce(null); // Third attempt succeeds

      const result = await service.generateUniqueSlug('Test Race');

      expect(result).toBe('test-race_3');
      expect(mockRaceRepo.findOne).toHaveBeenCalledTimes(3);
    });

    it('should throw error after max attempts', async () => {
      mockRaceRepo.findOne.mockResolvedValue({ id: '1' } as RaceEntity);

      await expect(service.generateUniqueSlug('Test Race')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getNextHourStart', () => {
    it('should return start of next hour', () => {
      const now = new Date('2025-01-15T14:30:45.123Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);

      const result = service.getNextHourStart();

      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getHours()).toBe(15); // Next hour
    });
  });

  describe('getRaceLeaderboard', () => {
    const raceId = 'race-leaderboard-test';

    it('should prefer Redis data over database', async () => {
      const mockRace = {
        id: raceId,
        status: RaceStatusEnum.ACTIVE,
        name: 'Test Race',
        prizes: [100, 50, 25],
      };

      mockRaceRepo.findOne.mockResolvedValue(mockRace as RaceEntity);

      const mockClient: any = {
        zrevrange: jest
          .fn()
          .mockResolvedValue(['user-1', '1000', 'user-2', '500', 'user-3', '250']),
      };

      mockRedisService.getClient.mockReturnValue(mockClient);

      const result = await service.getRaceLeaderboard(raceId, 100);

      // Should query Redis first
      expect(mockClient.zrevrange).toHaveBeenCalledWith(
        `race:wagers:${raceId}`,
        0,
        99,
        'WITHSCORES',
      );

      // Should not query database for participants
      expect(mockParticipantRepo.createQueryBuilder).not.toHaveBeenCalled();

      expect(result.leaderboard).toHaveLength(3);
    });

    it('should fall back to database if Redis unavailable', async () => {
      const mockRace = {
        id: raceId,
        status: RaceStatusEnum.ENDED,
        name: 'Ended Race',
        prizes: [100],
      };

      mockRaceRepo.findOne.mockResolvedValue(mockRace as RaceEntity);

      const mockClient: any = {
        zrevrange: jest.fn().mockResolvedValue([]), // Empty Redis
      };

      mockRedisService.getClient.mockReturnValue(mockClient);

      const mockQueryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            user: { id: 'user-1', username: 'player1' },
            totalWageredCents: '10000',
          },
        ]),
      };

      mockParticipantRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getRaceLeaderboard(raceId);

      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(result.leaderboard).toHaveLength(1);
    });
  });
});
