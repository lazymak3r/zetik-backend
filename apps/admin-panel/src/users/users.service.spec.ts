import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { IFindAllOptions, IUserEntity, UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let mockDataSource: jest.Mocked<Partial<DataSource>>;
  let mockRepository: any;
  let mockQueryBuilder: any;

  const mockUser: IUserEntity = {
    id: 'test-user-id',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: undefined,
    registrationStrategy: 'EMAIL',
    isBanned: false,
    isPrivate: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
      getCount: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return users with default pagination', async () => {
      const mockUsers = [mockUser, { ...mockUser, id: 'test-user-id-2', username: 'testuser2' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(result).toEqual(mockUsers);
    });

    it('should filter users by search query', async () => {
      const options: IFindAllOptions = { search: 'test' };
      mockQueryBuilder.getMany.mockResolvedValue([mockUser]);

      await service.findAll(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(user.username ILIKE :search OR user.displayName ILIKE :search)',
        { search: '%test%' },
      );
    });

    it('should filter users by banned status', async () => {
      const options: IFindAllOptions = { banned: true };
      mockQueryBuilder.getMany.mockResolvedValue([mockUser]);

      await service.findAll(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('user.isBanned = :banned', {
        banned: true,
      });
    });

    it('should filter users by registration strategy', async () => {
      const options: IFindAllOptions = { strategy: 'EMAIL' };
      mockQueryBuilder.getMany.mockResolvedValue([mockUser]);

      await service.findAll(options);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.registrationStrategy = :strategy',
        { strategy: 'EMAIL' },
      );
    });
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('test-user-id');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'test-user-id' },
        select: [
          'id',
          'username',
          'displayName',
          'avatarUrl',
          'registrationStrategy',
          'isBanned',
          'createdAt',
          'updatedAt',
        ],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent-id')).rejects.toThrow(NotFoundException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
        select: [
          'id',
          'username',
          'displayName',
          'avatarUrl',
          'registrationStrategy',
          'isBanned',
          'createdAt',
          'updatedAt',
        ],
      });
    });
  });

  describe('searchUsers', () => {
    it('should search users by query', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockUser]);

      const result = await service.searchUsers('test', 10);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'user.username ILIKE :query OR user.displayName ILIKE :query',
        { query: '%test%' },
      );
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockUser]);
    });
  });

  describe('findBannedUsers', () => {
    it('should return banned users', async () => {
      const bannedUsers = [{ ...mockUser, isBanned: true }];
      mockRepository.find.mockResolvedValue(bannedUsers);

      const result = await service.findBannedUsers(25, 5);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { isBanned: true },
        order: { updatedAt: 'DESC' },
        take: 25,
        skip: 5,
        select: [
          'id',
          'username',
          'displayName',
          'avatarUrl',
          'registrationStrategy',
          'isBanned',
          'createdAt',
          'updatedAt',
        ],
      });
      expect(result).toEqual(bannedUsers);
    });
  });

  describe('banUser', () => {
    it('should ban user successfully', async () => {
      const bannedUser = { ...mockUser, isBanned: true };
      mockRepository.findOne.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(bannedUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.banUser('test-user-id');

      expect(mockRepository.update).toHaveBeenCalledWith('test-user-id', {
        isBanned: true,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(bannedUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.banUser('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is already banned', async () => {
      const bannedUser = { ...mockUser, isBanned: true };
      mockRepository.findOne.mockResolvedValue(bannedUser);

      await expect(service.banUser('test-user-id')).rejects.toThrow('User is already banned');
    });
  });

  describe('unbanUser', () => {
    it('should unban user successfully', async () => {
      const bannedUser = { ...mockUser, isBanned: true };
      const unbannedUser = { ...mockUser, isBanned: false };
      mockRepository.findOne.mockResolvedValueOnce(bannedUser).mockResolvedValueOnce(unbannedUser);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.unbanUser('test-user-id');

      expect(mockRepository.update).toHaveBeenCalledWith('test-user-id', {
        isBanned: false,
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual(unbannedUser);
    });

    it('should throw error if user is not banned', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.unbanUser('test-user-id')).rejects.toThrow('User is not banned');
    });
  });

  describe('bulkBanUsers', () => {
    it('should ban multiple users successfully', async () => {
      const users = [mockUser, { ...mockUser, id: 'user-2' }];
      const bannedUsers = users.map((u) => ({ ...u, isBanned: true }));

      mockQueryBuilder.getMany.mockResolvedValueOnce(users).mockResolvedValueOnce(bannedUsers);
      mockQueryBuilder.execute.mockResolvedValue({ affected: 2 });

      const result = await service.bulkBanUsers(['test-user-id', 'user-2']);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('user.id IN (:...userIds)', {
        userIds: ['test-user-id', 'user-2'],
      });
      expect(result).toEqual(bannedUsers);
    });

    it('should throw error if all users are already banned', async () => {
      const bannedUsers = [{ ...mockUser, isBanned: true }];
      mockQueryBuilder.getMany.mockResolvedValue(bannedUsers);

      await expect(service.bulkBanUsers(['test-user-id'])).rejects.toThrow(
        'All specified users are already banned',
      );
    });
  });

  describe('getComprehensiveStats', () => {
    it('should return comprehensive user statistics', async () => {
      mockRepository.count.mockResolvedValueOnce(100); // total users
      mockRepository.count.mockResolvedValueOnce(5); // banned users

      // Mock strategy statistics
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        { strategy: 'EMAIL', count: '80' },
        { strategy: 'WALLET', count: '20' },
      ]);

      // Mock recent registrations and bans queries
      mockQueryBuilder.getCount
        .mockResolvedValueOnce(10) // recent registrations
        .mockResolvedValueOnce(2); // recent bans

      const result = await service.getComprehensiveStats();

      expect(result).toEqual({
        total: 100,
        banned: 5,
        active: 95,
        byStrategy: {
          EMAIL: 80,
          WALLET: 20,
        },
        recentRegistrations: 10,
        recentBans: 2,
      });
    });
  });

  describe('getUserActivity', () => {
    it('should return user activity summary', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      // Mock the query for activity data
      mockQueryBuilder.getRawOne.mockResolvedValue({
        totalSessions: 5,
        lastActivity: new Date('2024-01-02'),
      });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getUserActivity('test-user-id');

      expect(result.userId).toEqual('test-user-id');
      expect(result.registrationDate).toEqual(mockUser.createdAt);
    });
  });
});
