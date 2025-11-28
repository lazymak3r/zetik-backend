import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import { AuthStrategyEnum, UserEntity } from '@zetik/shared-entities';
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth/auth.service';
import { createTestProviders } from '../test-utils';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { SelfExclusionService } from './self-exclusion.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: UserEntity = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: true,
    isPhoneVerified: false,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      isEmailVerified: true,
    },
    isBanned: false,
    isPrivate: false,
    emailMarketing: true,
    streamerMode: false,
    excludeFromRain: false,
    hideStatistics: false,
    hideRaceStatistics: false,
    is2FAEnabled: false,
    twoFactorSecret: undefined,
    currentFiatFormat: FiatFormatEnum.STANDARD,
    currentCurrency: CurrencyEnum.USD,
    createdAt: new Date(),
    updatedAt: new Date(),
    displayName: 'Test User',
    avatarUrl: undefined,
    getActiveAvatarUrl: () => undefined,
  } as UserEntity;

  const mockUserProfile = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: true,
    isPhoneVerified: false,
    displayName: mockUser.displayName,
    avatarUrl: mockUser.avatarUrl,
    createdAt: new Date(),
    registrationStrategy: AuthStrategyEnum.EMAIL,
    currentFiatFormat: FiatFormatEnum.STANDARD,
    currentCurrency: CurrencyEnum.USD,
    vipLevel: 0,
    vipLevelImage: '',
    isPrivate: false,
    emailMarketing: true,
    streamerMode: false,
    excludeFromRain: false,
    hideStatistics: false,
    hideRaceStatistics: false,
  };

  beforeEach(async () => {
    const mockUsersService = {
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      searchUsers: jest.fn(),
      getUserStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        ...createTestProviders(),
        // Override specific mocks
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        // Mock SelfExclusionService required by controller constructor
        {
          provide: SelfExclusionService,
          useValue: {
            getActiveSelfExclusions: jest.fn(),
            getUserSelfExclusions: jest.fn(),
            createSelfExclusion: jest.fn(),
            cancelSelfExclusion: jest.fn(),
          },
        },
        // Mock AuthService required by controller constructor
        {
          provide: AuthService,
          useValue: {
            logout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  describe('updateProfile', () => {
    it('should update username successfully', async () => {
      const updateDto: UpdateUserProfileDto = {
        username: 'newusername',
      };

      const updatedProfile = {
        ...mockUserProfile,
        username: 'newusername',
      };

      usersService.updateUserProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateUserProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
      expect(result.username).toBe('newusername');
    });

    it('should update display name successfully', async () => {
      const updateDto: UpdateUserProfileDto = {
        displayName: 'New Display Name',
      };

      const updatedProfile = {
        ...mockUserProfile,
        displayName: 'New Display Name',
      };

      usersService.updateUserProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateUserProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
      expect(result.displayName).toBe('New Display Name');
    });

    it('should update avatar URL successfully', async () => {
      const updateDto: UpdateUserProfileDto = {
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      const updatedProfile = {
        ...mockUserProfile,
        avatarUrl: 'https://example.com/new-avatar.jpg',
      };

      usersService.updateUserProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateUserProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
      expect(result.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('should handle ConflictException when username already exists', async () => {
      const updateDto: UpdateUserProfileDto = {
        username: 'existingusername',
      };

      usersService.updateUserProfile.mockRejectedValue(
        new ConflictException('Username already exists'),
      );

      await expect(controller.updateProfile(mockUser, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should update isPrivate successfully', async () => {
      const updateDto: UpdateUserProfileDto = {
        isPrivate: true,
      };

      const updatedProfile = {
        ...mockUserProfile,
        isPrivate: true,
      };

      usersService.updateUserProfile.mockResolvedValue(updatedProfile);

      const result = await controller.updateProfile(mockUser, updateDto);

      expect(usersService.updateUserProfile).toHaveBeenCalledWith(mockUser.id, updateDto);
      expect(result.isPrivate).toBe(true);
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      usersService.getUserProfile.mockResolvedValue(mockUserProfile);

      const result = await controller.getProfile(mockUser);

      expect(usersService.getUserProfile).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUserProfile);
    });
  });
});
