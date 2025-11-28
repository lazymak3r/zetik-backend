import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { createTestProviders } from '../../test-utils';
import { SelfExclusionService } from '../../users/self-exclusion.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';
import { PendingAuthTokenService } from '../services/pending-auth-token.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { SessionTrackingService } from '../services/session-tracking.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';
import { TwoFactorAuthService } from '../services/two-factor-auth.service';

describe('Session Invalidation', () => {
  let authService: AuthService;

  const mockUsersService = {
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  };

  const mockRefreshTokenService = {
    deleteSessionById: jest.fn(),
    deleteSessionBySessionId: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteRefreshTokenBySessionId: jest.fn().mockResolvedValue(1),
    findTokenBySessionId: jest.fn(),
    deleteAllSessionsExceptCurrent: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    revokeToken: jest.fn(),
  };

  const mockTokenBlacklistService = {
    blacklistToken: jest.fn(),
    isBlacklisted: jest.fn(),
  };

  const mockSessionTrackingService = {
    createSession: jest.fn(),
    updateSessionTokenHash: jest.fn(),
    updateActivity: jest.fn(),
    getSessionByTokenHash: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
    getUserSessions: jest.fn(),
    isSessionActive: jest.fn(),
  };

  const mockTwoFactorAuthService = {
    generateSecret: jest.fn(),
    verifyToken: jest.fn(),
    enableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
  };

  const mockPendingAuthTokenService = {
    createPendingAuthToken: jest.fn(),
    validatePendingAuthToken: jest.fn(),
    deletePendingAuthToken: jest.fn(),
  };

  const mockSelfExclusionService = {
    checkPermanentExclusion: jest.fn(),
    getCurrentExclusion: jest.fn(),
  };

  const mockResponse = {
    clearCookie: jest.fn(),
    cookie: jest.fn(),
  } as unknown as Response;

  const mockTokenId = 'test-token-id';
  const mockRefreshToken = 'refresh-token-value';

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock JWT decode to return a payload with jti
    mockJwtService.decode.mockImplementation(() => {
      return { sub: 'test-user-id', username: 'testuser', jti: mockTokenId };
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ...createTestProviders(),
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: SessionTrackingService,
          useValue: mockSessionTrackingService,
        },
        {
          provide: TwoFactorAuthService,
          useValue: mockTwoFactorAuthService,
        },
        {
          provide: PendingAuthTokenService,
          useValue: mockPendingAuthTokenService,
        },
        {
          provide: SelfExclusionService,
          useValue: mockSelfExclusionService,
        },
        {
          provide: TokenBlacklistService,
          useValue: mockTokenBlacklistService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('deleteSessionById', () => {
    it('should delete session and blacklist refresh token', async () => {
      const testSessionId = '550e8400-e29b-41d4-a716-446655440000';
      const testUserId = 'test-user-id';

      // Mock session tracking service to return session
      mockSessionTrackingService.getSession.mockResolvedValue({
        sessionId: testSessionId,
        userId: testUserId,
        tokenHash: 'some-hash',
        ipAddress: '127.0.0.1',
        lastActivityAt: Date.now(),
      });

      // Mock refresh token service to return token
      mockRefreshTokenService.findTokenBySessionId.mockResolvedValue({
        id: 1,
        token: mockRefreshToken,
        userId: testUserId,
        sessionId: testSessionId,
      });

      // Mock the blacklist service to succeed
      mockTokenBlacklistService.blacklistToken.mockResolvedValue(true);

      // Call the method
      const result = await authService.deleteSessionById(testUserId, testSessionId);

      // Verify session was checked
      expect(mockSessionTrackingService.getSession).toHaveBeenCalledWith(testSessionId);

      // Verify refresh token was found and blacklisted
      expect(mockRefreshTokenService.findTokenBySessionId).toHaveBeenCalledWith(testSessionId);
      expect(mockJwtService.decode).toHaveBeenCalledWith(mockRefreshToken);
      expect(mockTokenBlacklistService.blacklistToken).toHaveBeenCalled();

      // Verify refresh token was revoked
      expect(mockRefreshTokenService.revokeToken).toHaveBeenCalled();

      // Verify session was deleted
      expect(mockSessionTrackingService.deleteSession).toHaveBeenCalledWith(testSessionId);

      // Verify the result
      expect(result).toEqual({ deletedCount: 1 });
    });
  });

  describe('deleteAllSessionsExceptCurrent', () => {
    it('should delete all sessions except current and blacklist tokens', async () => {
      const keepSessionId = '550e8400-e29b-41d4-a716-446655440000';
      const session2Id = '660e8400-e29b-41d4-a716-446655440001';
      const session3Id = '770e8400-e29b-41d4-a716-446655440002';
      const testUserId = 'test-user-id';

      // Mock getUserSessions to return 3 sessions
      mockSessionTrackingService.getUserSessions.mockResolvedValue([
        {
          sessionId: keepSessionId,
          userId: testUserId,
          tokenHash: 'hash-1',
          ipAddress: '127.0.0.1',
          lastActivityAt: Date.now(),
        },
        {
          sessionId: session2Id,
          userId: testUserId,
          tokenHash: 'hash-2',
          ipAddress: '127.0.0.1',
          lastActivityAt: Date.now(),
        },
        {
          sessionId: session3Id,
          userId: testUserId,
          tokenHash: 'hash-3',
          ipAddress: '127.0.0.1',
          lastActivityAt: Date.now(),
        },
      ]);

      // Mock refresh tokens for sessions to delete
      mockRefreshTokenService.findTokenBySessionId.mockResolvedValue({
        id: 1,
        token: mockRefreshToken,
        userId: testUserId,
      });

      // Mock the blacklist service to succeed
      mockTokenBlacklistService.blacklistToken.mockResolvedValue(true);

      // Call the method
      const result = await authService.deleteAllSessionsExceptCurrent(testUserId, keepSessionId);

      // Verify sessions were fetched
      expect(mockSessionTrackingService.getUserSessions).toHaveBeenCalledWith(testUserId);

      // Verify 2 sessions were deleted (not the keepSessionId)
      expect(mockSessionTrackingService.deleteSession).toHaveBeenCalledTimes(2);
      expect(mockSessionTrackingService.deleteSession).toHaveBeenCalledWith(session2Id);
      expect(mockSessionTrackingService.deleteSession).toHaveBeenCalledWith(session3Id);

      // Verify the result
      expect(result).toEqual({ deletedCount: 2 });
    });
  });

  describe('logout', () => {
    it('should blacklist access token and delete current session', async () => {
      const testUserId = 'test-user-id';
      const testSessionId = '550e8400-e29b-41d4-a716-446655440000';
      const testAccessToken = 'test-access-token';

      // Mock request with access token
      const mockRequest = {
        cookies: {
          access_token: testAccessToken,
        },
        headers: {},
      };

      const mockResponseWithReq = {
        ...mockResponse,
        req: mockRequest,
      } as unknown as Response;

      // Mock JwtService decode for access token
      mockJwtService.decode.mockReturnValue({
        sub: testUserId,
        jti: mockTokenId,
        exp: Math.floor(Date.now() / 1000) + 900, // 15 min from now
      });

      // Mock session tracking
      mockSessionTrackingService.getSessionByTokenHash.mockResolvedValue({
        sessionId: testSessionId,
        userId: testUserId,
        tokenHash: 'some-hash',
        ipAddress: '127.0.0.1',
        lastActivityAt: Date.now(),
      });

      // Mock the blacklist service to succeed
      mockTokenBlacklistService.blacklistToken.mockResolvedValue(true);

      // Call the method
      await authService.logout(testUserId, mockResponseWithReq);

      // Verify access token was blacklisted
      expect(mockJwtService.decode).toHaveBeenCalledWith(testAccessToken);
      expect(mockTokenBlacklistService.blacklistToken).toHaveBeenCalledWith(
        mockTokenId,
        expect.any(Number),
      );

      // Verify session was found and deleted
      expect(mockSessionTrackingService.getSessionByTokenHash).toHaveBeenCalled();
      expect(mockSessionTrackingService.deleteSession).toHaveBeenCalledWith(testSessionId);

      // Verify cookies were cleared
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
    });
  });
});
