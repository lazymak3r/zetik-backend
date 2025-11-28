import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyEnum, FiatFormatEnum, PasswordUtil } from '@zetik/common';
import { AuthStrategyEnum } from '@zetik/shared-entities';
import { Response } from 'express';
import { AffiliateService } from '../../affiliate/affiliate.service';
import { createTestProviders } from '../../test-utils';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { EmailLoginDto } from '../dto/email-login.dto';
import { EmailRegisterDto } from '../dto/email.register.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { PendingAuthTokenService } from '../services/pending-auth-token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { SessionTrackingService } from '../services/session-tracking.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';

jest.mock('@zetik/common', () => {
  const actual = jest.requireActual('@zetik/common');
  return {
    ...actual,
    PasswordUtil: {
      verify: jest.fn(),
      hash: jest.fn(),
    },
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let refreshTokenService: RefreshTokenService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    req: {
      headers: {
        'user-agent': 'test-agent',
      },
    },
  } as unknown as Response;

  const createMockUser = (overrides: any = {}) => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: false,
    isPhoneVerified: false,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      isEmailVerified: false,
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
    getActiveAvatarUrl: () => undefined,
    ...overrides,
  });

  const mockUser = createMockUser();

  beforeEach(async () => {
    // Set required environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findByEmailOrUsername: jest.fn(),
            createWithEmail: jest.fn(),
            findById: jest.fn(),
            updateRegistrationData: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: AffiliateService,
          useValue: {
            trackAffiliateAction: jest.fn(),
            processReferral: jest.fn(),
            createCampaign: jest.fn(),
            resolveCampaignRefToId: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            createRefreshToken: jest.fn(),
            findTokenByValue: jest.fn(),
            revokeToken: jest.fn(),
            revokeAllUserTokens: jest.fn(),
            findTokenBySessionId: jest.fn(),
            deleteSessionBySessionId: jest.fn(),
          },
        },
        {
          provide: SessionTrackingService,
          useValue: {
            createSession: jest.fn().mockResolvedValue('mock-session-id'),
            updateSessionTokenHash: jest.fn(),
            updateActivity: jest.fn(),
            getSessionByTokenHash: jest.fn(),
            getSession: jest.fn(),
            deleteSession: jest.fn(),
            getUserSessions: jest.fn().mockResolvedValue([]),
            isSessionActive: jest.fn(),
          },
        },
        {
          provide: TwoFactorAuthService,
          useValue: {
            generateSecret: jest.fn(),
            verifyToken: jest.fn(),
            enableTwoFactor: jest.fn(),
            disableTwoFactor: jest.fn(),
          },
        },
        {
          provide: PendingAuthTokenService,
          useValue: {
            createPendingAuthToken: jest.fn(),
            validatePendingAuthToken: jest.fn(),
            validateAndConsumePendingAuthToken: jest.fn(),
            deletePendingAuthToken: jest.fn(),
          },
        },
        {
          provide: TokenBlacklistService,
          useValue: {
            blacklistToken: jest.fn().mockResolvedValue(true),
            isBlacklisted: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: 'AUTH_CONFIG',
          useValue: {
            accessSecret: 'test-access-secret-key',
            accessExpiration: '15m',
            refreshSecret: 'test-refresh-secret-key',
            refreshExpiration: '30d',
          },
        },
        {
          provide: SelfExclusionService,
          useValue: {
            getActiveSelfExclusions: jest.fn(),
            hasActiveSelfExclusion: jest.fn(),
            formatRemainingTime: jest.fn(),
          },
        },
        {
          provide: 'DistributedLockService',
          useValue: {
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(true),
          },
        },
        // Add other common providers to prevent DI failures
        ...createTestProviders({
          includeNotificationService: false, // Not used in auth
          includeBalanceService: false, // Not used in auth
          includeRedisService: false, // Not used in auth
        }),
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    refreshTokenService = module.get<RefreshTokenService>(RefreshTokenService);
    jest.clearAllMocks();
  });

  describe('registerWithEmail', () => {
    const registerDto: EmailRegisterDto = {
      email: 'new@example.com',
      username: 'newuser',
      password: 'SecurePassword123!',
    };

    it('should register a new user successfully', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'createWithEmail').mockResolvedValue(mockUser);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.registerWithEmail(registerDto, mockResponse);

      expect(usersService.createWithEmail).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.username,
        registerDto.password,
        undefined,
      );
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(result).toHaveProperty('user');
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException if email already exists', async () => {
      jest
        .spyOn(usersService, 'createWithEmail')
        .mockRejectedValue(new ConflictException('Email already exists'));

      await expect(service.registerWithEmail(registerDto, mockResponse)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if username already exists', async () => {
      jest
        .spyOn(usersService, 'createWithEmail')
        .mockRejectedValue(new ConflictException('Username already exists'));

      await expect(service.registerWithEmail(registerDto, mockResponse)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException if referral code is invalid', async () => {
      const { BadRequestException } = require('@nestjs/common');
      const dtoWithInvalidCode: EmailRegisterDto = {
        ...registerDto,
        affiliateCampaignId: 'invalid-code',
      };

      jest
        .spyOn(usersService, 'createWithEmail')
        .mockRejectedValue(new BadRequestException('Invalid referral code'));

      await expect(service.registerWithEmail(dtoWithInvalidCode, mockResponse)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.registerWithEmail(dtoWithInvalidCode, mockResponse)).rejects.toThrow(
        'Invalid referral code',
      );
    });
  });

  describe('loginWithEmail', () => {
    const loginDto: EmailLoginDto = {
      email: 'test@example.com',
      password: 'TestPassword123!',
    };

    it('should login user successfully with correct credentials', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginWithEmail(loginDto, mockResponse);

      expect(usersService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(PasswordUtil.verify).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.registrationData.passwordHash,
      );
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      await expect(service.loginWithEmail(loginDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(PasswordUtil.verify).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.loginWithEmail(loginDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is banned', async () => {
      const bannedUser = createMockUser({ isBanned: true });
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(bannedUser);
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);

      await expect(service.loginWithEmail(loginDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    // TODO: Add test for different registration strategy when more strategies are implemented

    it('should login user with username successfully', async () => {
      const usernameLoginDto: EmailLoginDto = {
        email: 'testuser',
        password: 'TestPassword123!',
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'findByEmailOrUsername').mockResolvedValue(mockUser);
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginWithEmailOrUsername(usernameLoginDto, mockResponse);

      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith('testuser');
      expect(PasswordUtil.verify).toHaveBeenCalledWith(
        'TestPassword123!',
        mockUser.registrationData.passwordHash,
      );
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
    });

    it('should login user with case-insensitive username', async () => {
      const usernameLoginDto: EmailLoginDto = {
        email: 'TestUser',
        password: 'TestPassword123!',
      };

      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };

      jest.spyOn(usersService, 'findByEmailOrUsername').mockResolvedValue(mockUser);
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service.loginWithEmailOrUsername(usernameLoginDto, mockResponse);

      expect(usersService.findByEmailOrUsername).toHaveBeenCalledWith('TestUser');
      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
    });
  });

  describe('refreshTokens', () => {
    const refreshTokenDto: RefreshTokenDto = {
      refreshToken: 'valid-refresh-token',
    };

    it('should refresh tokens successfully', async () => {
      const mockSavedToken = {
        id: 1,
        token: 'valid-refresh-token',
        user: mockUser,
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any;
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });
      jest
        .spyOn(refreshTokenService, 'findTokenByValue')
        .mockImplementation(() => Promise.resolve(mockSavedToken));
      jest.spyOn(refreshTokenService, 'revokeToken').mockResolvedValue(undefined as any);
      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(newTokens.accessToken)
        .mockReturnValueOnce(newTokens.refreshToken);

      const result = await service.refreshTokens(refreshTokenDto, mockResponse);

      expect(jwtService.verify).toHaveBeenCalledWith(refreshTokenDto.refreshToken, {
        secret: 'your-refresh-secret-key',
      });
      expect(refreshTokenService.findTokenByValue).toHaveBeenCalledWith(
        refreshTokenDto.refreshToken,
        false,
        expect.any(String),
      );
      expect(refreshTokenService.revokeToken).toHaveBeenCalledWith(mockSavedToken.id);
      expect(result).toHaveProperty('accessToken', newTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', newTokens.refreshToken);
      expect(result.refreshToken).not.toBe(refreshTokenDto.refreshToken);

      // Check that refresh token includes timestamp
      const mockDate = new Date('2025-05-25T00:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const tokens = service['generateTokens'](mockUser);

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('refresh-token');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          username: mockUser.username,
          iat: Math.floor(mockDate.getTime() / 1000),
        }),
        expect.objectContaining({
          secret: 'your-refresh-secret-key',
          expiresIn: '30d',
        }),
      );
    });

    it('should throw UnauthorizedException if token is invalid', async () => {
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshTokens(refreshTokenDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if token not found in database', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: mockUser.id });
      jest
        .spyOn(refreshTokenService, 'findTokenByValue')
        .mockImplementation(() => Promise.resolve(null));

      await expect(service.refreshTokens(refreshTokenDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if user is banned', async () => {
      const bannedUser = createMockUser({ isBanned: true });
      const mockSavedToken = {
        id: 1,
        token: 'valid-refresh-token',
        user: bannedUser,
        userId: bannedUser.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      } as any;

      jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: bannedUser.id });
      jest
        .spyOn(refreshTokenService, 'findTokenByValue')
        .mockImplementation(() => Promise.resolve(mockSavedToken));

      await expect(service.refreshTokens(refreshTokenDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if lock cannot be acquired (race condition)', async () => {
      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: UsersService,
            useValue: usersService,
          },
          {
            provide: JwtService,
            useValue: jwtService,
          },
          {
            provide: RefreshTokenService,
            useValue: refreshTokenService,
          },
          {
            provide: SessionTrackingService,
            useValue: {
              createSession: jest.fn().mockResolvedValue('mock-session-id'),
              updateSessionTokenHash: jest.fn(),
            },
          },
          {
            provide: TokenBlacklistService,
            useValue: {
              blacklistToken: jest.fn().mockResolvedValue(true),
            },
          },
          {
            provide: TwoFactorAuthService,
            useValue: {
              verifyToken: jest.fn(),
            },
          },
          {
            provide: PendingAuthTokenService,
            useValue: {
              createPendingAuthToken: jest.fn(),
            },
          },
          {
            provide: SelfExclusionService,
            useValue: {
              getActiveSelfExclusions: jest.fn(),
            },
          },
          {
            provide: 'DistributedLockService',
            useValue: {
              acquireLock: jest.fn().mockResolvedValue(false), // Lock NOT acquired
              releaseLock: jest.fn().mockResolvedValue(true),
            },
          },
          {
            provide: 'AUTH_CONFIG',
            useValue: {
              accessSecret: 'test-access-secret-key',
              accessExpiration: '15m',
              refreshSecret: 'test-refresh-secret-key',
              refreshExpiration: '30d',
            },
          },
          ...createTestProviders({
            includeNotificationService: false,
            includeBalanceService: false,
            includeRedisService: false,
          }),
        ],
      }).compile();

      const testService = module.get<AuthService>(AuthService);

      await expect(testService.refreshTokens(refreshTokenDto, mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should logout user successfully', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockSessionId = 'mock-session-id';

      // Mock request with access token
      mockResponse.req = {
        cookies: { access_token: mockAccessToken },
        headers: {},
      } as any;

      // Mock JWT decode
      const mockJwtService = (service as any).jwtService;
      mockJwtService.decode = jest.fn().mockReturnValue({
        sub: mockUser.id,
        jti: 'mock-jti',
        exp: Math.floor(Date.now() / 1000) + 900,
      });

      // Mock session tracking
      const sessionTrackingService = (service as any).sessionTrackingService;
      sessionTrackingService.getSessionByTokenHash = jest.fn().mockResolvedValue({
        sessionId: mockSessionId,
        userId: mockUser.id,
      });
      sessionTrackingService.deleteSession = jest.fn().mockResolvedValue(undefined);

      await service.logout(mockUser.id, mockResponse);

      // Should NOT revoke all tokens anymore (only current session)
      expect(refreshTokenService.revokeAllUserTokens).not.toHaveBeenCalled();

      // Should clear cookies
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', expect.any(Object));
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', expect.any(Object));
    });
  });

  describe('updatePassword', () => {
    const updatePasswordInput = {
      currentPassword: 'currentPassword123',
      newPassword: 'newPassword123',
    };

    beforeEach(() => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
      jest.spyOn(usersService, 'updateRegistrationData').mockResolvedValue(undefined);
    });

    it('should update password successfully for email user', async () => {
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      (PasswordUtil.hash as jest.Mock).mockResolvedValue('new-hashed-password');

      await service.updatePassword(mockUser.id, updatePasswordInput);

      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(PasswordUtil.verify).toHaveBeenCalledWith(
        updatePasswordInput.currentPassword,
        mockUser.registrationData.passwordHash,
      );
      expect(PasswordUtil.hash).toHaveBeenCalledWith(updatePasswordInput.newPassword);
      expect(usersService.updateRegistrationData).toHaveBeenCalledWith(mockUser.id, {
        ...mockUser.registrationData,
        passwordHash: 'new-hashed-password',
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.updatePassword('non-existent-id', updatePasswordInput)).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );

      expect(PasswordUtil.verify).not.toHaveBeenCalled();
      expect(usersService.updateRegistrationData).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user is not email user', async () => {
      const metamaskUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.METAMASK,
        registrationData: { address: '0x123' },
      };
      jest.spyOn(usersService, 'findById').mockResolvedValue(metamaskUser);

      await expect(service.updatePassword(metamaskUser.id, updatePasswordInput)).rejects.toThrow(
        new UnauthorizedException('Password update not available for this account type'),
      );

      expect(PasswordUtil.verify).not.toHaveBeenCalled();
      expect(usersService.updateRegistrationData).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.updatePassword(mockUser.id, updatePasswordInput)).rejects.toThrow(
        new UnauthorizedException('Current password is incorrect'),
      );

      expect(PasswordUtil.verify).toHaveBeenCalledWith(
        updatePasswordInput.currentPassword,
        mockUser.registrationData.passwordHash,
      );
      expect(PasswordUtil.hash).not.toHaveBeenCalled();
      expect(usersService.updateRegistrationData).not.toHaveBeenCalled();
    });

    it('should handle password hashing errors', async () => {
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      (PasswordUtil.hash as jest.Mock).mockRejectedValue(new Error('Hashing failed'));

      await expect(service.updatePassword(mockUser.id, updatePasswordInput)).rejects.toThrow(
        'Hashing failed',
      );

      expect(PasswordUtil.verify).toHaveBeenCalled();
      expect(PasswordUtil.hash).toHaveBeenCalledWith(updatePasswordInput.newPassword);
      expect(usersService.updateRegistrationData).not.toHaveBeenCalled();
    });

    it('should handle database update errors', async () => {
      (PasswordUtil.verify as jest.Mock).mockResolvedValue(true);
      (PasswordUtil.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      jest
        .spyOn(usersService, 'updateRegistrationData')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.updatePassword(mockUser.id, updatePasswordInput)).rejects.toThrow(
        'Database error',
      );

      expect(PasswordUtil.verify).toHaveBeenCalled();
      expect(PasswordUtil.hash).toHaveBeenCalled();
      expect(usersService.updateRegistrationData).toHaveBeenCalled();
    });
  });

  describe('getEmailValidationStatus', () => {
    beforeEach(() => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser);
    });

    it('should return validation status for email user', async () => {
      const emailUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.EMAIL,
        isEmailVerified: true,
        registrationData: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
        },
      };
      jest.spyOn(usersService, 'findById').mockResolvedValue(emailUser);

      const result = await service.getEmailValidationStatus(emailUser.id);

      expect(usersService.findById).toHaveBeenCalledWith(emailUser.id);
      expect(result).toEqual({
        registrationStrategy: AuthStrategyEnum.EMAIL,
        isValidated: true,
      });
    });

    it('should return validation status false for unverified email user', async () => {
      const unverifiedEmailUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.EMAIL,
        registrationData: {
          email: 'test@example.com',
          passwordHash: 'hashed-password',
          isEmailVerified: false,
        },
      };
      jest.spyOn(usersService, 'findById').mockResolvedValue(unverifiedEmailUser);

      const result = await service.getEmailValidationStatus(unverifiedEmailUser.id);

      expect(result).toEqual({
        registrationStrategy: AuthStrategyEnum.EMAIL,
        isValidated: false,
      });
    });

    it('should return undefined isValidated for metamask user', async () => {
      const metamaskUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.METAMASK,
        registrationData: { address: '0x123' },
      };
      jest.spyOn(usersService, 'findById').mockResolvedValue(metamaskUser);

      const result = await service.getEmailValidationStatus(metamaskUser.id);

      expect(result).toEqual({
        registrationStrategy: AuthStrategyEnum.METAMASK,
        isValidated: undefined,
      });
    });

    it('should return undefined isValidated for google user', async () => {
      const googleUser = {
        ...mockUser,
        registrationStrategy: AuthStrategyEnum.GOOGLE,
        registrationData: {
          id: 'google-123',
          email: 'test@gmail.com',
          name: 'John Doe',
        },
      };
      jest.spyOn(usersService, 'findById').mockResolvedValue(googleUser);

      const result = await service.getEmailValidationStatus(googleUser.id);

      expect(result).toEqual({
        registrationStrategy: AuthStrategyEnum.GOOGLE,
        isValidated: undefined,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      jest.spyOn(usersService, 'findById').mockResolvedValue(null);

      await expect(service.getEmailValidationStatus('non-existent-id')).rejects.toThrow(
        new UnauthorizedException('User not found'),
      );

      expect(usersService.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('generateTokens', () => {
    it('should generate unique tokens with timestamps', () => {
      const mockDate = new Date('2025-05-25T00:00:00.000Z');
      jest.spyOn(Date, 'now').mockReturnValue(mockDate.getTime());

      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const tokens = service['generateTokens'](mockUser);

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('refresh-token');

      // Check that refresh token includes timestamp
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUser.id,
          username: mockUser.username,
          iat: Math.floor(mockDate.getTime() / 1000),
        }),
        expect.objectContaining({
          secret: 'your-refresh-secret-key',
          expiresIn: '30d',
        }),
      );
    });
  });

  describe('setAuthCookiesAndReturnTokens', () => {
    it('should set cookies with correct options', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenId: 'mock-token-id',
      };

      jest
        .spyOn(jwtService, 'sign')
        .mockReturnValueOnce(mockTokens.accessToken)
        .mockReturnValueOnce(mockTokens.refreshToken);

      const result = await service['setAuthCookiesAndReturnTokens'](
        mockUser,
        mockResponse,
        mockTokens.accessToken,
        mockTokens.refreshToken,
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockTokens.accessToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: expect.any(Number),
          path: '/',
        }),
      );

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokens.refreshToken,
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'none',
          maxAge: expect.any(Number),
          path: '/auth/refresh',
        }),
      );

      expect(result).toEqual({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          email: 'test@example.com',
        },
      });
    });
  });

  describe('parseJwtExpirationToMs', () => {
    it('should parse different time formats correctly', () => {
      expect(service['parseJwtExpirationToMs']('30s')).toBe(30000);
      expect(service['parseJwtExpirationToMs']('15m')).toBe(900000);
      expect(service['parseJwtExpirationToMs']('2h')).toBe(7200000);
      expect(service['parseJwtExpirationToMs']('7d')).toBe(604800000);
      expect(service['parseJwtExpirationToMs']('invalid')).toBe(3600000); // default
    });
  });
});
