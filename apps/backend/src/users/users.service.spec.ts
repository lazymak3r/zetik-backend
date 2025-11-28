import { AuthStrategyEnum, IEmailRegistrationData, UserEntity } from '@zetik/shared-entities';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { UserVipStatusService } from '../bonus/services/user-vip-status.service';
import { VipTierService } from '../bonus/services/vip-tier.service';
import { RedisService } from '../common/services/redis.service';
import { createTestProviders } from '../test-utils';
import { SelfExclusionService } from './self-exclusion.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: Repository<UserEntity>;
  let balanceService: BalanceService;
  let userVipStatusService: UserVipStatusService;
  let vipTierService: VipTierService;
  let selfExclusionService: SelfExclusionService;

  const createMockUser = (overrides?: Partial<UserEntity>): UserEntity =>
    ({
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      isEmailVerified: false,
      isPhoneVerified: false,
      displayName: 'Test User',
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date('2023-01-01'),
      isPrivate: false,
      emailMarketing: true,
      streamerMode: false,
      excludeFromRain: false,
      hideStatistics: false,
      hideRaceStatistics: false,
      is2FAEnabled: false,
      twoFactorSecret: undefined,
      registrationStrategy: 'EMAIL' as any,
      registrationData: {
        passwordHash: 'hashed-password',
      } as any,
      isBanned: false,
      affiliateCampaignId: undefined,
      currentFiatFormat: 'STANDARD' as any,
      currentCurrency: 'USD' as any,
      updatedAt: new Date('2023-01-01'),
      getActiveAvatarUrl: () => undefined,
      ...overrides,
    }) as UserEntity;

  const mockUser = createMockUser();

  const mockPrivateUser: Partial<UserEntity> = {
    id: 'private-user-id',
    username: 'privateuser',
    displayName: 'Private User',
    avatarUrl: undefined,
    createdAt: new Date('2023-02-01'),
    isPrivate: true,
  };

  const mockBalanceStats = {
    userId: 'test-user-id',
    betCount: 150,
    winCount: 89,
    bets: '500000', // 5000.00 USD in cents
    wins: '350000', // 3500.00 USD in cents
    deps: '0',
    withs: '0',
    refunds: '0',
  };

  const mockVipStatus = {
    userId: 'test-user-id',
    vipLevel: 5,
    vipLevelImage: 'user-level/gold-1',
  };

  const mockVipTier = {
    level: 5,
    name: 'Gold I',
    imageUrl: 'user-level/gold-1',
    isForVip: true,
    wagerRequirement: '1000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            getBalanceStatisticsForUsers: jest.fn(),
          },
        },
        {
          provide: UserVipStatusService,
          useValue: {
            getUsersVipStatus: jest.fn(),
          },
        },
        {
          provide: VipTierService,
          useValue: {
            findTierByLevel: jest.fn(),
          },
        },
        {
          provide: SelfExclusionService,
          useValue: {
            getActiveSelfExclusions: jest.fn(),
            hasActiveSelfExclusion: jest.fn(),
            createSelfExclusion: jest.fn(),
            getUserSelfExclusions: jest.fn(),
            cancelSelfExclusion: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    balanceService = module.get<BalanceService>(BalanceService);
    userVipStatusService = module.get<UserVipStatusService>(UserVipStatusService);
    vipTierService = module.get<VipTierService>(VipTierService);
    selfExclusionService = module.get<SelfExclusionService>(SelfExclusionService);

    // Set up default mocks for services used in unified profile
    jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
    jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
    jest
      .spyOn(balanceService, 'getBalanceStatisticsForUsers')
      .mockResolvedValue([mockBalanceStats]);
    jest.spyOn(selfExclusionService, 'getActiveSelfExclusions').mockResolvedValue([]);
  });

  describe('updateRegistrationData', () => {
    const newRegistrationData: IEmailRegistrationData = {
      passwordHash: 'new-hashed-password',
    };

    it('should update registration data successfully', async () => {
      const updatedUser = createMockUser({ registrationData: newRegistrationData });

      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(updatedUser);

      await service.updateRegistrationData(mockUser.id, newRegistrationData);

      expect(service.findById).toHaveBeenCalledWith(mockUser.id);
      expect(userRepository.save).toHaveBeenCalledWith({
        ...mockUser,
        registrationData: newRegistrationData,
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        service.updateRegistrationData('non-existent-id', newRegistrationData),
      ).rejects.toThrow(new NotFoundException('User not found'));

      expect(service.findById).toHaveBeenCalledWith('non-existent-id');
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should handle database save errors', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userRepository, 'save').mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateRegistrationData(mockUser.id, newRegistrationData),
      ).rejects.toThrow('Database error');

      expect(service.findById).toHaveBeenCalledWith(mockUser.id);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should update different types of registration data', async () => {
      const metamaskRegistrationData = { address: '0x123' };
      const metamaskUser = createMockUser({
        registrationStrategy: AuthStrategyEnum.METAMASK,
        registrationData: metamaskRegistrationData,
      });

      jest.spyOn(service, 'findById').mockResolvedValue(metamaskUser as UserEntity);
      jest.spyOn(userRepository, 'save').mockResolvedValue(metamaskUser);

      await service.updateRegistrationData(metamaskUser.id, metamaskRegistrationData);

      expect(service.findById).toHaveBeenCalledWith(metamaskUser.id);
      expect(userRepository.save).toHaveBeenCalledWith({
        ...metamaskUser,
        registrationData: metamaskRegistrationData,
      });
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);

      const result = await service.findById(mockUser.id);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: mockUser.id } });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.findById('non-existent-id');

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'non-existent-id' } });
      expect(result).toBeNull();
    });
  });

  describe('generateUniqueUsername', () => {
    it('should return clean username when unique', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.generateUniqueUsername('john_doe');

      expect(result).toBe('john_doe');
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { username: 'john_doe' } });
    });

    it('should clean username from invalid characters', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.generateUniqueUsername('john@doe!123');

      expect(result).toBe('johndoe123');
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { username: 'johndoe123' } });
    });

    it('should truncate long username', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const longUsername = 'a'.repeat(25);
      const result = await service.generateUniqueUsername(longUsername);

      expect(result).toBe('a'.repeat(20));
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { username: 'a'.repeat(20) } });
    });

    it('should use default when username too short after cleaning', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      const result = await service.generateUniqueUsername('@@');

      expect(result).toBe('user');
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { username: 'user' } });
    });

    it('should add suffix when username exists', async () => {
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce({ username: 'john' } as UserEntity)
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername('john');

      expect(result).toBe('john_1');
      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
      expect(userRepository.findOne).toHaveBeenNthCalledWith(1, { where: { username: 'john' } });
      expect(userRepository.findOne).toHaveBeenNthCalledWith(2, { where: { username: 'john_1' } });
    });

    it('should increment suffix until unique username found', async () => {
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce({ username: 'user' } as UserEntity)
        .mockResolvedValueOnce({ username: 'user_1' } as UserEntity)
        .mockResolvedValueOnce({ username: 'user_2' } as UserEntity)
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername('user');

      expect(result).toBe('user_3');
      expect(userRepository.findOne).toHaveBeenCalledTimes(4);
    });

    it('should handle long username with suffix', async () => {
      const longBase = 'a'.repeat(20);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce({ username: longBase } as UserEntity)
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername(longBase + 'extra');

      expect(result).toBe(longBase + '_1');
      expect(result.length).toBeLessThanOrEqual(32);
    });

    it('should truncate base when username with suffix too long', async () => {
      const veryLongBase = 'a'.repeat(30);
      jest
        .spyOn(userRepository, 'findOne')
        .mockResolvedValueOnce({ username: veryLongBase } as UserEntity)
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername(veryLongBase + 'extra');

      expect(result).toBe('a'.repeat(20) + '_1');
      expect(result.length).toBe(22);
    });
  });

  describe('getPublicUserProfile', () => {
    it('should return public user profile for non-private user', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([mockBalanceStats]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result).toEqual({
        userName: 'Test User',
        userId: 'test-user-id',
        createdAt: new Date('2023-01-01'),
        avatarUrl: 'https://example.com/avatar.jpg',
        vipLevel: {
          level: 5,
          name: 'Gold I',
          imageUrl: 'user-level/gold-1',
        },
        statistics: {
          totalBets: 150,
          numberOfWins: 89,
          numberOfLosses: 61, // 150 - 89
          wagered: '5,000.00 USD',
        },
      });

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'test-user-id' } });
      expect(userVipStatusService.getUsersVipStatus).toHaveBeenCalledWith(['test-user-id']);
      expect(vipTierService.findTierByLevel).toHaveBeenCalledWith(5);
      expect(balanceService.getBalanceStatisticsForUsers).toHaveBeenCalledWith(['test-user-id']);
    });

    it('should use username if displayName is null', async () => {
      // Arrange
      const userWithoutDisplayName = createMockUser({ displayName: undefined });
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutDisplayName);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([mockBalanceStats]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result.userName).toBe('testuser');
    });

    it('should handle user with no VIP status', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue({
        level: 0,
        name: 'Visitor',
        imageUrl: '',
        isForVip: false,
        wagerRequirement: '0',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([mockBalanceStats]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result.vipLevel).toEqual({
        level: 0,
        name: 'Visitor',
        imageUrl: '',
      });
    });

    it('should handle user with no statistics', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest.spyOn(balanceService, 'getBalanceStatisticsForUsers').mockResolvedValue([]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result.statistics).toEqual({
        totalBets: 0,
        numberOfWins: 0,
        numberOfLosses: 0,
        wagered: '0.00 USD',
      });
    });

    it('should prevent negative numberOfLosses', async () => {
      // Arrange
      const statsWithMoreWinsThanBets = {
        userId: 'test-user-id',
        betCount: 10,
        winCount: 15, // More wins than bets (edge case)
        bets: '100000',
        wins: '150000',
        deps: '0',
        withs: '0',
        refunds: '0',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([statsWithMoreWinsThanBets]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result.statistics).toBeDefined();
      expect(result.statistics!.numberOfLosses).toBe(0); // Should not be negative
      expect(result.statistics!.totalBets).toBe(10);
      expect(result.statistics!.numberOfWins).toBe(15);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPublicUserProfile('non-existent-user')).rejects.toThrow(
        NotFoundException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'non-existent-user' } });
    });

    it('should throw ForbiddenException when user profile is private', async () => {
      // Arrange
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockPrivateUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([mockBalanceStats]);

      // Act & Assert
      await expect(service.getPublicUserProfile('private-user-id')).rejects.toThrow(
        ForbiddenException,
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'private-user-id' } });
    });

    it('should format wagered amount correctly', async () => {
      // Arrange
      const statsWithLargeAmount = {
        userId: 'test-user-id',
        betCount: 1000,
        winCount: 600,
        bets: '123456789', // 1,234,567.89 USD in cents
        wins: '98765432',
        deps: '0',
        withs: '0',
        refunds: '0',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as UserEntity);
      jest.spyOn(userVipStatusService, 'getUsersVipStatus').mockResolvedValue([mockVipStatus]);
      jest.spyOn(vipTierService, 'findTierByLevel').mockResolvedValue(mockVipTier);
      jest
        .spyOn(balanceService, 'getBalanceStatisticsForUsers')
        .mockResolvedValue([statsWithLargeAmount]);

      // Act
      const result = await service.getPublicUserProfile('test-user-id');

      // Assert
      expect(result.statistics).toBeDefined();
      expect(result.statistics!.wagered).toBe('1,234,567.89 USD');
    });
  });

  describe('findByEmailOrUsername', () => {
    it('should find user by email', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByEmailOrUsername('test@example.com');

      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.email = :emailOrUsername', {
        emailOrUsername: 'test@example.com',
      });
      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'LOWER(user.username) = LOWER(:emailOrUsername)',
        { emailOrUsername: 'test@example.com' },
      );
      expect(result).toBe(mockUser);
    });

    it('should find user by username (case-insensitive)', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByEmailOrUsername('TestUser');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.email = :emailOrUsername', {
        emailOrUsername: 'TestUser',
      });
      expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
        'LOWER(user.username) = LOWER(:emailOrUsername)',
        { emailOrUsername: 'TestUser' },
      );
      expect(result).toBe(mockUser);
    });

    it('should return null if user not found', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      jest.spyOn(userRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

      const result = await service.findByEmailOrUsername('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });
});
