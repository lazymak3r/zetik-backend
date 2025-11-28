import { Test, TestingModule } from '@nestjs/testing';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Mock all decorators to avoid dependency issues
jest.mock('../audit/decorators/audit-log.decorator', () => ({
  AuditLog: () => () => {},
}));

jest.mock('../audit/interceptors/audit-log.interceptor', () => ({
  AuditLogInterceptor: class {
    intercept(context: any, next: any) {
      return next.handle();
    }
  },
}));

jest.mock('../auth/guards/jwt-auth.guard', () => ({
  JwtAuthGuard: class {
    canActivate() {
      return true;
    }
  },
}));

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: undefined,
    registrationStrategy: 'EMAIL',
    isBanned: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockUsersService = {
    findAll: jest.fn(),
    searchUsers: jest.fn(),
    findBannedUsers: jest.fn(),
    getComprehensiveStats: jest.fn(),
    getUserActivity: jest.fn(),
    findById: jest.fn(),
    bulkBanUsers: jest.fn(),
    banUser: jest.fn(),
    unbanUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should use search when search query provided', async () => {
      const mockUsers = [mockUser];
      mockUsersService.searchUsers.mockResolvedValue(mockUsers);

      const result = await controller.getUsers(0, 10, 0, 'testuser');

      expect(usersService.searchUsers).toHaveBeenCalledWith('testuser', 10);
      expect(result).toEqual(mockUsers);
    });

    it('should use banned filter when banned=true', async () => {
      const bannedUsers = [{ ...mockUser, isBanned: true }];
      mockUsersService.findBannedUsers.mockResolvedValue(bannedUsers);

      const result = await controller.getUsers(0, 10, 0, undefined, true);

      expect(usersService.findBannedUsers).toHaveBeenCalledWith(10, 0);
      expect(result).toEqual(bannedUsers);
    });

    it('should use findAll for general filtering', async () => {
      const mockUsers = [mockUser];
      mockUsersService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.getUsers(
        0,
        10,
        0,
        undefined,
        false,
        false,
        'username',
        'EMAIL',
        'ASC',
      );

      expect(usersService.findAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        search: undefined,
        banned: false,
        strategy: 'EMAIL',
        sortBy: 'username',
        sortOrder: 'ASC',
      });
      expect(result).toEqual(mockUsers);
    });
  });

  describe('getUsersStats', () => {
    it('should return comprehensive statistics', async () => {
      const mockStats = {
        total: 100,
        banned: 5,
        active: 95,
        byStrategy: { EMAIL: 80, WALLET: 20 },
        recentRegistrations: 10,
        recentBans: 2,
      };
      mockUsersService.getComprehensiveStats.mockResolvedValue(mockStats);

      const result = await controller.getUsersStats();

      expect(usersService.getComprehensiveStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getUserById', () => {
    it('should return user details without activity', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.getUserById('test-user-id');

      expect(usersService.findById).toHaveBeenCalledWith('test-user-id');
      expect(result).toEqual(mockUser);
    });

    it('should return user activity when includeActivity=true', async () => {
      const mockActivity = {
        userId: 'test-user-id',
        registrationDate: new Date('2024-01-01'),
        lastActivity: new Date('2024-01-02'),
        totalSessions: 5,
        bannedHistory: [],
      };
      mockUsersService.getUserActivity.mockResolvedValue(mockActivity);

      const result = await controller.getUserById('test-user-id', true);

      expect(usersService.getUserActivity).toHaveBeenCalledWith('test-user-id');
      expect(result).toEqual(mockActivity);
    });
  });

  describe('bulkUserActions', () => {
    it('should perform bulk ban action', async () => {
      const userIds = ['user-1', 'user-2'];
      const bannedUsers = [
        { ...mockUser, id: 'user-1', isBanned: true },
        { ...mockUser, id: 'user-2', isBanned: true },
      ];
      mockUsersService.bulkBanUsers.mockResolvedValue(bannedUsers);

      const result = await controller.bulkUserActions({
        userIds,
        action: 'ban',
        reason: 'Test reason',
      });

      expect(usersService.bulkBanUsers).toHaveBeenCalledWith(userIds);
      expect(result).toEqual(bannedUsers);
    });

    it('should perform bulk unban action', async () => {
      const userIds = ['user-1', 'user-2'];
      const unbannedUser = { ...mockUser, isBanned: false };
      mockUsersService.unbanUser.mockResolvedValue(unbannedUser);

      const result = await controller.bulkUserActions({
        userIds,
        action: 'unban',
        reason: 'Test reason',
      });

      expect(usersService.unbanUser).toHaveBeenCalledTimes(2);
      expect(usersService.unbanUser).toHaveBeenCalledWith('user-1');
      expect(usersService.unbanUser).toHaveBeenCalledWith('user-2');
      expect(result).toEqual([unbannedUser, unbannedUser]);
    });
  });
});
