import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { JwtRefreshStrategy } from '../strategies/jwt-refresh.strategy';

describe('JwtRefreshStrategy', () => {
  let jwtRefreshStrategy: JwtRefreshStrategy;

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockTokenBlacklistService = {
    isBlacklisted: jest.fn(),
  };

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    isBanned: false,
  } as UserEntity;

  const mockRequest = {} as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
      ],
    }).compile();

    jwtRefreshStrategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  describe('validate', () => {
    it('should throw UnauthorizedException if token is blacklisted', async () => {
      // Mock the blacklist service to return true (token is blacklisted)
      mockTokenBlacklistService.isBlacklisted.mockResolvedValue(true);

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'blacklisted-token-id' };

      // Expect the validate method to throw an UnauthorizedException
      await expect(jwtRefreshStrategy.validate(mockRequest, payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('blacklisted-token-id');
    });

    it('should return user if token is not blacklisted', async () => {
      // Mock the blacklist service to return false (token is not blacklisted)
      mockTokenBlacklistService.isBlacklisted.mockResolvedValue(false);

      // Mock the users service to return a user
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'valid-token-id' };

      // Call the validate method
      const result = await jwtRefreshStrategy.validate(mockRequest, payload);

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('valid-token-id');

      // Verify the users service was called
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-user-id');

      // Verify the result is the user
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException if user is banned', async () => {
      // Mock the blacklist service to return false (token is not blacklisted)
      mockTokenBlacklistService.isBlacklisted.mockResolvedValue(false);

      // Mock the users service to return a banned user
      mockUsersService.findById.mockResolvedValue({
        ...mockUser,
        isBanned: true,
      });

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'valid-token-id' };

      // Expect the validate method to throw an UnauthorizedException
      await expect(jwtRefreshStrategy.validate(mockRequest, payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('valid-token-id');

      // Verify the users service was called
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-user-id');
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      // Mock the blacklist service to return false (token is not blacklisted)
      mockTokenBlacklistService.isBlacklisted.mockResolvedValue(false);

      // Mock the users service to return null (user not found)
      mockUsersService.findById.mockResolvedValue(null);

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'valid-token-id' };

      // Expect the validate method to throw an UnauthorizedException
      await expect(jwtRefreshStrategy.validate(mockRequest, payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('valid-token-id');

      // Verify the users service was called
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-user-id');
    });
  });
});
