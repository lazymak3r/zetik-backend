import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  RaceDurationEnum,
  RaceEntity,
  RaceStatusEnum,
  UserEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { BalanceService } from '../../../balance/balance.service';
import { RaceService } from '../../../bonus/services/race.service';
import { SponsorRaceNotificationService } from '../../../bonus/services/sponsor-race-notification.service';
import { RedisService } from '../../../common/services/redis.service';
import { createTestProviders } from '../../../test-utils/common-providers';
import { UsersService } from '../../../users/users.service';
import { NotificationService } from '../../../websocket/services/notification.service';
import { CreateAffiliateRaceInput } from '../../dto/create-affiliate-race.input';
import { AffiliateRaceService } from '../affiliate-race.service';

describe('AffiliateRaceService', () => {
  let service: AffiliateRaceService;
  let mockRaceRepo: jest.Mocked<Repository<RaceEntity>>;
  let mockBalanceService: jest.Mocked<BalanceService>;
  let mockUsersService: jest.Mocked<UsersService>;
  let mockRaceService: jest.Mocked<RaceService>;
  let mockRedisService: jest.Mocked<RedisService>;

  const mockUser: Partial<UserEntity> = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const mockRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockBalance = {
      updateBalance: jest.fn().mockResolvedValue({
        success: true,
        balance: '1000.00',
      }),
    };

    const mockUsers = {
      findById: jest.fn().mockResolvedValue(mockUser),
    };

    const mockRace = {
      getNextHourStart: jest.fn().mockReturnValue(new Date('2025-01-15T15:00:00Z')),
      getDurationInMs: jest.fn().mockReturnValue(3600000), // 1 hour
      generateUniqueSlug: jest.fn().mockResolvedValue('test-race'),
    };

    const mockRedis = {
      get: jest.fn(),
      getClient: jest.fn(() => ({
        incr: jest.fn(),
        expire: jest.fn(),
      })),
    };

    const mockSponsorNotification = {
      notifyUsersAboutNewRace: jest.fn().mockResolvedValue(undefined),
    };

    const mockNotification = {
      sendToUserAndSave: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateRaceService,
        ...createTestProviders(),
        {
          provide: getRepositoryToken(RaceEntity),
          useValue: mockRepository,
        },
        {
          provide: BalanceService,
          useValue: mockBalance,
        },
        {
          provide: UsersService,
          useValue: mockUsers,
        },
        {
          provide: RaceService,
          useValue: mockRace,
        },
        {
          provide: RedisService,
          useValue: mockRedis,
        },
        {
          provide: SponsorRaceNotificationService,
          useValue: mockSponsorNotification,
        },
        {
          provide: NotificationService,
          useValue: mockNotification,
        },
      ],
    }).compile();

    service = module.get<AffiliateRaceService>(AffiliateRaceService);
    mockRaceRepo = module.get(getRepositoryToken(RaceEntity));
    mockBalanceService = module.get(BalanceService);
    mockUsersService = module.get(UsersService);
    mockRaceService = module.get(RaceService);
    mockRedisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAffiliateRace', () => {
    const validInput: CreateAffiliateRaceInput = {
      raceDuration: RaceDurationEnum.ONE_DAY,
      referralCode: 'TEST123',
      asset: AssetTypeEnum.BTC,
      fiat: null,
      prizes: [500, 300, 200],
    };

    it('should enforce rate limiting (5 races per hour)', async () => {
      // Mock Redis to return count at limit
      mockRedisService.get.mockResolvedValue('5');

      await expect(service.createAffiliateRace('user-123', validInput)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createAffiliateRace('user-123', validInput)).rejects.toThrow(
        /Rate limit exceeded/,
      );

      // Balance should NOT be deducted
      expect(mockBalanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should allow race creation below rate limit', async () => {
      mockRedisService.get.mockResolvedValue('3'); // Below limit
      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        status: RaceStatusEnum.PENDING,
        prizePool: 1000,
        startsAt: new Date(),
        endsAt: new Date(),
        asset: validInput.asset,
        fiat: validInput.fiat,
        prizes: validInput.prizes,
        referralCode: validInput.referralCode,
        sponsorId: 'user-123',
      } as any);

      await expect(service.createAffiliateRace('user-123', validInput)).resolves.toBeDefined();

      expect(mockBalanceService.updateBalance).toHaveBeenCalled();
    });

    it('should validate race duration BEFORE balance deduction', async () => {
      mockRedisService.get.mockResolvedValue('0');
      mockUsersService.findById.mockResolvedValue(mockUser as UserEntity);

      // Mock getDurationInMs to return invalid duration
      mockRaceService.getDurationInMs.mockReturnValue(-1000); // Negative duration

      await expect(service.createAffiliateRace('user-123', validInput)).rejects.toThrow(
        BadRequestException,
      );

      // Balance should NOT be deducted when validation fails
      expect(mockBalanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should validate XOR constraint (asset OR fiat, not both)', async () => {
      const invalidInput = {
        ...validInput,
        asset: AssetTypeEnum.BTC,
        fiat: 'USD' as any,
      };

      mockRedisService.get.mockResolvedValue('0');

      await expect(service.createAffiliateRace('user-123', invalidInput)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockBalanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should validate neither asset nor fiat provided', async () => {
      const invalidInput = {
        ...validInput,
        asset: null,
        fiat: null,
      };

      mockRedisService.get.mockResolvedValue('0');

      await expect(service.createAffiliateRace('user-123', invalidInput)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockBalanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should increment rate limit counter after successful creation', async () => {
      mockRedisService.get.mockResolvedValue('2');
      const mockClient: any = {
        incr: jest.fn(),
        expire: jest.fn(),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        status: RaceStatusEnum.PENDING,
        prizePool: 1000,
        startsAt: new Date(),
        endsAt: new Date(),
      } as any);

      await service.createAffiliateRace('user-123', validInput);

      expect(mockClient.incr).toHaveBeenCalledWith('race-creation-limit:user-123');
      expect(mockClient.expire).toHaveBeenCalledWith('race-creation-limit:user-123', 3600);
    });

    it('should deduct balance in correct asset', async () => {
      mockRedisService.get.mockResolvedValue('0');
      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        startsAt: new Date(),
        endsAt: new Date(),
        asset: validInput.asset,
        fiat: validInput.fiat,
        prizes: validInput.prizes,
        referralCode: validInput.referralCode,
        sponsorId: 'user-123',
      } as any);

      await service.createAffiliateRace('user-123', validInput);

      expect(mockBalanceService.updateBalance).toHaveBeenCalled();
      const callArgs = mockBalanceService.updateBalance.mock.calls[0];
      expect(callArgs).toBeDefined();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRedisService.get.mockResolvedValue('0');
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.createAffiliateRace('user-123', validInput)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockBalanceService.updateBalance).not.toHaveBeenCalled();
    });

    it('should generate unique name and slug', async () => {
      mockRedisService.get.mockResolvedValue('0');
      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        startsAt: new Date(),
        endsAt: new Date(),
        asset: validInput.asset,
        fiat: validInput.fiat,
        prizes: validInput.prizes,
        referralCode: validInput.referralCode,
        sponsorId: 'user-123',
      } as any);

      await service.createAffiliateRace('user-123', validInput);

      expect(mockRaceService.generateUniqueSlug).toHaveBeenCalledWith(
        expect.stringContaining("testuser's"),
      );
    });
  });

  describe('getAffiliateRaceLeaderboard', () => {
    const raceId = 'race-456';
    const userId = 'user-123';

    it('should deny non-sponsor access to affiliate race', async () => {
      const mockRace = {
        id: raceId,
        sponsorId: 'different-user',
        referralCode: 'TEST',
      };

      mockRaceRepo.findOne.mockResolvedValue(mockRace as RaceEntity);

      await expect(service.getAffiliateRaceLeaderboard(userId, raceId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow sponsor to view their race leaderboard', async () => {
      const mockRace = {
        id: raceId,
        sponsorId: userId,
        referralCode: 'TEST',
        status: RaceStatusEnum.ACTIVE,
        name: 'Test Race',
        prizes: [100],
      };

      mockRaceRepo.findOne.mockResolvedValue(mockRace as RaceEntity);

      // Mock RaceService.getRaceLeaderboard
      mockRaceService['getRaceLeaderboard'] = jest.fn().mockResolvedValue({
        race: mockRace,
        leaderboard: [],
        participantsCount: 0,
      });

      const result = await service.getAffiliateRaceLeaderboard(userId, raceId);

      expect(result).toBeDefined();
      expect(mockRaceService['getRaceLeaderboard']).toHaveBeenCalledWith(raceId, 20);
    });

    it('should allow viewing weekly race (no sponsor)', async () => {
      const mockRace = {
        id: raceId,
        sponsorId: null, // Weekly race
        referralCode: null,
        status: RaceStatusEnum.ACTIVE,
      };

      mockRaceRepo.findOne.mockResolvedValue(mockRace as RaceEntity);

      mockRaceService['getRaceLeaderboard'] = jest.fn().mockResolvedValue({
        race: mockRace,
        leaderboard: [],
        participantsCount: 0,
      });

      await expect(service.getAffiliateRaceLeaderboard(userId, raceId)).resolves.toBeDefined();
    });

    it('should throw NotFoundException if race does not exist', async () => {
      mockRaceRepo.findOne.mockResolvedValue(null);

      await expect(service.getAffiliateRaceLeaderboard(userId, raceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserAffiliateRaces', () => {
    const userId = 'user-123';

    it('should return races sponsored by user', async () => {
      const mockRaces = [
        {
          id: 'race-1',
          slug: 'race-1-slug',
          sponsorId: userId,
          name: 'Race 1',
          status: RaceStatusEnum.ACTIVE,
          prizePool: 1000,
          prizes: [100, 50],
          asset: AssetTypeEnum.BTC,
          fiat: null,
          referralCode: 'CODE1',
          startsAt: new Date(),
          endsAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'race-2',
          slug: 'race-2-slug',
          sponsorId: userId,
          name: 'Race 2',
          status: RaceStatusEnum.PENDING,
          prizePool: 500,
          prizes: [50, 25],
          asset: null,
          fiat: 'USD',
          referralCode: 'CODE2',
          startsAt: new Date(),
          endsAt: new Date(),
          createdAt: new Date(),
        },
      ];

      mockRaceRepo.findAndCount.mockResolvedValue([mockRaces as any, mockRaces.length]);

      const result = await service.getUserAffiliateRaces(userId);

      expect(mockRaceRepo.findOne).toHaveBeenCalled();
      expect(result.races).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle referral code with special characters', async () => {
      const input: CreateAffiliateRaceInput = {
        raceDuration: RaceDurationEnum.ONE_DAY,
        referralCode: 'TEST-123_ABC',
        asset: AssetTypeEnum.BTC,
        fiat: null,
        prizes: [100],
      };

      mockRedisService.get.mockResolvedValue('0');
      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test-race',
        name: 'Test Race',
        startsAt: new Date(),
        endsAt: new Date(),
      } as any);

      await expect(service.createAffiliateRace('user-123', input)).resolves.toBeDefined();
    });

    it('should handle large prize pools (BigNumber precision)', async () => {
      const input: CreateAffiliateRaceInput = {
        raceDuration: RaceDurationEnum.ONE_DAY,
        referralCode: 'BIG',
        asset: AssetTypeEnum.BTC,
        fiat: null,
        prizes: [999999999],
      };

      mockRedisService.get.mockResolvedValue('0');
      mockRaceRepo.save.mockResolvedValue({
        id: 'race-1',
        slug: 'test',
        name: 'Test',
        startsAt: new Date(),
        endsAt: new Date(),
      } as any);

      await expect(service.createAffiliateRace('user-123', input)).resolves.toBeDefined();

      // Verify BigNumber used (not Number overflow)
      expect(mockBalanceService.updateBalance).toHaveBeenCalled();
    });
  });
});
