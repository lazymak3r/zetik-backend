import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { BalanceService } from '../../balance/balance.service';
import { RedisService } from '../../common/services/redis.service';
import { UsersService } from '../../users/users.service';
import { SessionTrackingService } from '../services/session-tracking.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { JwtStrategy } from '../strategies/jwt.strategy';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockBalanceService = {
    getPrimaryWallet: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: () => Promise.resolve(true),
    del: jest.fn(),
  };

  const mockTokenBlacklistService = {
    isBlacklisted: jest.fn(),
  };

  const mockSessionTrackingService = {
    updateActivity: jest.fn(),
  };

  const mockRequest = {
    cookies: { access_token: 'test-access-token' },
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;

  const mockUser = {
    id: 'test-user-id',
    username: 'testuser',
    isBanned: false,
  } as UserEntity;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
        {
          provide: 'UserCacheService',
          useValue: {
            invalidateJwtCache: jest.fn(),
          },
        },
        {
          provide: SessionTrackingService,
          useValue: mockSessionTrackingService,
        },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should throw UnauthorizedException if token is blacklisted', async () => {
      // Mock the blacklist service to return true (token is blacklisted)
      mockTokenBlacklistService.isBlacklisted.mockResolvedValue(true);

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'blacklisted-token-id' };

      // Expect the validate method to throw an UnauthorizedException
      await expect(jwtStrategy.validate(mockRequest, payload)).rejects.toThrow(
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

      // Mock the balance service to return null (no primary wallet)
      mockBalanceService.getPrimaryWallet.mockResolvedValue(null);

      // Create a payload with a token ID
      const payload = { sub: 'test-user-id', username: 'testuser', jti: 'valid-token-id' };

      // Call the validate method
      const result = await jwtStrategy.validate(mockRequest, payload);

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('valid-token-id');

      // Verify the users service was called
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-user-id');

      // Verify the result is the user
      expect(result).toEqual(
        expect.objectContaining({
          id: 'test-user-id',
          username: 'testuser',
        }),
      );
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
      await expect(jwtStrategy.validate(mockRequest, payload)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the blacklist service was called with the correct token ID
      expect(mockTokenBlacklistService.isBlacklisted).toHaveBeenCalledWith('valid-token-id');

      // Verify the users service was called
      expect(mockUsersService.findById).toHaveBeenCalledWith('test-user-id');
    });
  });
});
