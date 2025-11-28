import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordUtil } from '@zetik/common';
import {
  AuthStrategyEnum,
  IEmailRegistrationData,
  SelfExclusionTypeEnum,
  UserEntity,
} from '@zetik/shared-entities';
import bs58 from 'bs58';
import { verifyMessage } from 'ethers';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Lock } from 'redlock';
import { DistributedLockService } from '../common/services/distributed-lock.service';
import { authConfig } from '../config/auth.config';
import { commonConfig } from '../config/common.config';
import { SelfExclusionService } from '../users/self-exclusion.service';
import { UsersService } from '../users/users.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { IEmailValidationStatusResponse } from './dto/email-validation-status.dto';
import { EmailRegisterDto } from './dto/email.register.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { MetamaskLoginOrRegisterDto } from './dto/metamask-login-or-register.dto';
import { PendingAuthResponseDto } from './dto/pending-auth-response.dto';
import { PhantomLoginOrRegisterDto } from './dto/phantom-login-or-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SteamLoginDto } from './dto/steam-login.dto';
import { SteamRegisterDto } from './dto/steam-register.dto';
import { IUpdatePasswordInput } from './dto/update-password.dto';
import {
  DeleteSessionsResponseDto,
  UserSessionDto,
  UserSessionsResponseDto,
} from './dto/user-session.dto';
import { Verify2FALoginDto } from './dto/verify-2fa-login.dto';
import { PendingAuthTokenService } from './services/pending-auth-token.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionTrackingService } from './services/session-tracking.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { TwoFactorAuthService } from './services/two-factor-auth.service';
import { verifyGoogleIdToken } from './utils/google-id-token.util';
import { exchangeGoogleCodeForTokens } from './utils/google-oauth.util';
import { verifySolanaSignature } from './utils/solana-signature.util';
import { extractSteamId, getSteamUserData, verifySteamOpenId } from './utils/steam-openid.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;
  private readonly googleClientId: string;
  private readonly googleClientSecret: string;
  private readonly steamApiKey: string;
  private readonly steamRealm: string;
  private readonly isProduction: boolean;
  private readonly isLocalEnvironment: boolean;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly sessionTrackingService: SessionTrackingService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly pendingAuthTokenService: PendingAuthTokenService,
    private readonly selfExclusionService: SelfExclusionService,
    private readonly distributedLockService: DistributedLockService,
  ) {
    // Initialize configuration values on service creation
    this.accessSecret = authConfig().secret;
    this.refreshSecret = authConfig().refreshSecret;
    this.accessExpiration = authConfig().accessExpiration;
    this.refreshExpiration = authConfig().refreshExpiration;
    this.googleClientId = authConfig().googleClientId;
    this.googleClientSecret = authConfig().googleClientSecret;
    this.steamApiKey = authConfig().steamApiKey;
    this.steamRealm = authConfig().steamRealm;
    this.isProduction = commonConfig().isProduction;

    // Detect local environment by checking if frontend URL contains localhost or 127.0.0.1
    const frontendUrl = commonConfig().frontendUrl;
    this.isLocalEnvironment =
      frontendUrl.includes('localhost') ||
      frontendUrl.includes('127.0.0.1') ||
      frontendUrl.startsWith('http://');

    if (!this.accessSecret || !this.refreshSecret) {
      throw new Error('JWT secrets not configured');
    }
  }

  async registerWithEmail(
    registerDto: EmailRegisterDto,
    response: Response,
  ): Promise<AuthResponseDto> {
    const user = await this.usersService.createWithEmail(
      registerDto.email,
      registerDto.username,
      registerDto.password,
      registerDto.affiliateCampaignId, // This is actually the referral code from frontend
    );

    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  async loginWithEmail(loginDto: EmailLoginDto, response: Response): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify that this is an email-based user
    if (user.registrationStrategy !== AuthStrategyEnum.EMAIL) {
      throw new UnauthorizedException('Invalid login method');
    }

    // TypeScript type guard to ensure we have email registration data
    const emailRegData = user.registrationData as IEmailRegistrationData;

    // Verify the password
    const isPasswordValid = await PasswordUtil.verify(loginDto.password, emailRegData.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  async loginWithEmailOrUsername(
    loginDto: EmailLoginDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    const user = await this.usersService.findByEmailOrUsername(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify that this is an email-based user
    if (user.registrationStrategy !== AuthStrategyEnum.EMAIL) {
      throw new UnauthorizedException('Invalid login method');
    }

    // TypeScript type guard to ensure we have email registration data
    const emailRegData = user.registrationData as IEmailRegistrationData;

    // Verify the password
    const isPasswordValid = await PasswordUtil.verify(loginDto.password, emailRegData.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  async verifyTwoFactorLogin(dto: Verify2FALoginDto, response: Response): Promise<AuthResponseDto> {
    const pendingAuthData = await this.pendingAuthTokenService.validateAndConsumePendingAuthToken(
      dto.pendingAuthToken,
    );

    const user = await this.usersService.findById(pendingAuthData.userId);

    if (!user) {
      throw new UnauthorizedException('Authentication failed');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Access denied');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    if (!user.is2FAEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Authentication failed');
    }

    const isValid = await this.twoFactorAuthService.verifyTwoFactorAuthenticationToken(
      dto.twoFactorCode,
      user.twoFactorSecret,
      user.id,
    );

    if (!isValid) {
      throw new UnauthorizedException('Authentication failed');
    }

    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  /**
   * Helper method to check if device is trusted and if 2FA is required
   * Returns PendingAuthResponseDto if 2FA is required, null otherwise
   */
  private async checkDeviceAndRequire2FA(
    user: UserEntity,
    response: Response,
  ): Promise<PendingAuthResponseDto | null> {
    if (!user.is2FAEnabled) {
      return null;
    }

    const userAgentHeader = response.req?.headers?.['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : 'not available';
    const deviceInfo = this.parseDeviceInfo(userAgent);
    const extractedIp = this.extractClientIpAddress(response.req);
    const ipAddress = extractedIp || '127.0.0.1';

    const isKnown = await this.refreshTokenService.isKnownDevice(user.id, ipAddress, deviceInfo);

    if (!isKnown) {
      const pendingAuthToken = await this.pendingAuthTokenService.createPendingAuthToken({
        userId: user.id,
        ipAddress,
        deviceInfo,
      });

      return {
        requiresTwoFactor: true,
        pendingAuthToken,
        message: 'Please provide your 2FA code to complete login from this new device',
      };
    }

    return null;
  }

  async refreshTokens(
    refreshTokenDto: RefreshTokenDto,
    response: Response,
  ): Promise<AuthResponseDto> {
    // Compute token hash for distributed lock
    const refreshTokenHash = SessionTrackingService.computeTokenHash(refreshTokenDto.refreshToken);
    const lockKey = `refresh:token:${refreshTokenHash}`;
    const lockTTL = 10000; // 10 seconds - enough for token refresh operation

    let lock: Lock | null = null;

    try {
      // ✅ Acquire distributed lock to prevent race conditions on concurrent refresh requests
      lock = await this.distributedLockService.acquireLock(lockKey, lockTTL, {
        retryCount: 0, // Fail fast if lock is already held
      });

      // Verify JWT but ignore the payload as we'll get user from the database
      this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.refreshSecret,
      });

      // Get IP address from request
      const extractedIp = this.extractClientIpAddress(response.req);
      const ipAddress = extractedIp || '127.0.0.1';

      // Check if token exists in database first
      const savedToken = await this.refreshTokenService.findTokenByValue(
        refreshTokenDto.refreshToken,
        false, // don't update yet
        ipAddress,
      );

      if (!savedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = savedToken.user;

      if (user.isBanned) {
        throw new UnauthorizedException('User is banned');
      }

      // Check for permanent self-exclusion
      await this.checkPermanentExclusion(user.id);

      // Verify JWT and get payload for blacklisting
      const decoded = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.refreshSecret,
      });

      // ✅ Generate new tokens with SAME sessionId (rotation)
      // Note: sessionId is stored in DB refresh_tokens table, not in JWT payload
      const { accessToken, refreshToken } = this.generateTokens(user, savedToken.sessionId);
      const tokenHash = SessionTrackingService.computeTokenHash(accessToken);

      // ✅ Update session tokenHash (keep same session, just update the hash)
      if (savedToken.sessionId) {
        try {
          await this.sessionTrackingService.updateSessionTokenHash(savedToken.sessionId, tokenHash);
        } catch (error) {
          this.logger.warn('Failed to update session token hash during refresh', error);
        }
      }

      // ✅ Blacklist old refresh token (prevent replay attacks)
      if (decoded.jti) {
        try {
          // Calculate TTL: time until old refresh token expires
          const now = Math.floor(Date.now() / 1000);
          const exp = decoded.exp || now + 30 * 24 * 60 * 60; // Default 30 days if no exp
          const ttlSeconds = Math.max(exp - now, 0);

          await this.tokenBlacklistService.blacklistToken(decoded.jti, ttlSeconds);
        } catch (error) {
          this.logger.error('Failed to blacklist old refresh token', error);
          // Don't throw - continue with token rotation
        }
      }

      // ✅ Delete old refresh token from database
      await this.refreshTokenService.revokeToken(savedToken.id);

      // ✅ Set new cookies and create new refresh token in database
      const result = await this.setAuthCookiesAndReturnTokens(
        user,
        response,
        accessToken,
        refreshToken,
      );

      return result;
    } catch (error) {
      // If lock acquisition fails, it means another request is processing the same token
      if (error instanceof Error && error.message?.includes('lock')) {
        throw new UnauthorizedException('Token refresh already in progress. Please retry.');
      }

      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error; // Re-throw self-exclusion and auth errors
      }

      throw new UnauthorizedException('Invalid refresh token');
    } finally {
      // ✅ Always release the lock, even if an error occurred
      if (lock) {
        await this.distributedLockService.releaseLock(lock).catch((err) => {
          this.logger.error('Failed to release refresh token lock', { lockKey, error: err });
        });
      }
    }
  }

  async logout(userId: string, response: Response): Promise<void> {
    try {
      // Get current session from access token
      const accessToken = this.extractAccessToken(response.req);
      if (accessToken) {
        // Blacklist current access token JTI
        try {
          const decoded = this.jwtService.decode(accessToken);
          if (decoded && typeof decoded === 'object' && decoded.jti) {
            const now = Math.floor(Date.now() / 1000);
            const ttlSeconds = Math.max(decoded.exp - now, 0);
            await this.tokenBlacklistService.blacklistToken(decoded.jti, ttlSeconds);
          }
        } catch (error) {
          this.logger.warn('Failed to blacklist access token JTI during logout', error);
        }

        // Delete current session
        const tokenHash = SessionTrackingService.computeTokenHash(accessToken);
        const session = await this.sessionTrackingService.getSessionByTokenHash(tokenHash);
        if (session) {
          await this.sessionTrackingService.deleteSession(session.sessionId);
        }
      }
    } catch (error) {
      this.logger.error('Failed to logout session', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Clear cookies
    response.clearCookie('access_token', {
      path: '/',
      httpOnly: true,
      secure: !this.isLocalEnvironment,
      sameSite: this.isProduction ? 'strict' : this.isLocalEnvironment ? 'lax' : 'none',
      domain: this.isLocalEnvironment ? 'localhost' : undefined,
    });
    response.clearCookie('refresh_token', {
      path: '/auth/refresh',
      httpOnly: true,
      secure: !this.isLocalEnvironment,
      sameSite: this.isProduction ? 'strict' : this.isLocalEnvironment ? 'lax' : 'none',
      domain: this.isLocalEnvironment ? 'localhost' : undefined,
    });
  }

  /**
   * Get all active sessions for a user
   * @param userId The user ID to get sessions for
   * @param request The request object from the controller
   * @returns List of user sessions
   */
  async getUserSessions(userId: string, request: Request): Promise<UserSessionsResponseDto> {
    // Get all sessions from Redis
    const sessions = await this.sessionTrackingService.getUserSessions(userId);

    // Try to identify current session using the access token hash
    let currentSessionId: string | undefined;

    try {
      const accessToken = this.extractAccessToken(request);
      if (accessToken) {
        const tokenHash = SessionTrackingService.computeTokenHash(accessToken);
        const session = await this.sessionTrackingService.getSessionByTokenHash(tokenHash);
        if (session) {
          currentSessionId = session.sessionId;
        }
      }
    } catch (error) {
      this.logger.warn('Failed to identify current session by token:', error);
    }

    const now = Date.now();
    const activeThreshold = 1 * 60 * 1000; // 1 minute

    const sessionDtos: UserSessionDto[] = sessions.map((session) => {
      const isActive = now - session.lastActivityAt < activeThreshold;

      // Calculate expiration (30 days from creation)
      const expiresAt = new Date(session.lastActivityAt + 30 * 24 * 60 * 60 * 1000);

      const isCurrentSession = currentSessionId ? session.sessionId === currentSessionId : false;

      return {
        id: session.sessionId,
        deviceInfo: session.deviceInfo || 'Unknown Device',
        expiresAt,
        isCurrentSession,
        isActive,
        lastUse: new Date(session.lastActivityAt),
        ipAddress: session.ipAddress || 'Unknown',
        location: session.location || 'Unknown Location',
      };
    });

    return { sessions: sessionDtos };
  }

  private extractAccessToken(request?: Request): string | null {
    if (!request) {
      return null;
    }

    // Check cookies first
    if (request.cookies) {
      const cookies = request.cookies as { access_token?: string };
      if (cookies.access_token) {
        return cookies.access_token;
      }
    }

    // Check Authorization header
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    return null;
  }

  /**
   * Delete a specific session by ID
   * @param userId The user ID the session belongs to
   * @param sessionId The ID of the session to delete
   * @returns The number of deleted sessions
   */
  async deleteSessionById(userId: string, sessionId: string): Promise<DeleteSessionsResponseDto> {
    // Verify session exists and belongs to user
    const session = await this.sessionTrackingService.getSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found or does not belong to user');
    }

    try {
      // Find and blacklist refresh token associated with this session
      const refreshToken = await this.refreshTokenService.findTokenBySessionId(sessionId);

      if (refreshToken) {
        try {
          const decodedToken = this.jwtService.decode(refreshToken.token);
          if (decodedToken && typeof decodedToken === 'object' && decodedToken.jti) {
            const now = Math.floor(Date.now() / 1000);
            const ttlSeconds = Math.max((decodedToken.exp as number) - now, 0);
            await this.tokenBlacklistService.blacklistToken(decodedToken.jti, ttlSeconds);
          }
        } catch (error) {
          this.logger.error('Failed to blacklist refresh token JTI during session deletion', {
            userId,
            sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        await this.refreshTokenService.revokeToken(refreshToken.id);
      }

      // Delete session from Redis and DB
      await this.sessionTrackingService.deleteSession(sessionId);

      return { deletedCount: 1 };
    } catch (error) {
      this.logger.error('Failed to delete session', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete all sessions for a user except the specified one
   * @param userId The user ID to delete sessions for
   * @param keepSessionId The ID of the session to keep
   * @returns The number of deleted sessions
   */
  async deleteAllSessionsExceptCurrent(
    userId: string,
    keepSessionId: string,
  ): Promise<DeleteSessionsResponseDto> {
    const sessions = await this.sessionTrackingService.getUserSessions(userId);
    const sessionsToDelete = sessions.filter((s) => s.sessionId !== keepSessionId);

    let deletedCount = 0;

    for (const session of sessionsToDelete) {
      try {
        await this.sessionTrackingService.deleteSession(session.sessionId);

        // Find and delete refresh token
        const refreshTokenResult = await this.refreshTokenService.deleteSessionBySessionId(
          userId,
          session.sessionId,
        );

        if (refreshTokenResult.token) {
          const decodedToken = this.jwtService.decode(refreshTokenResult.token);
          if (decodedToken && typeof decodedToken === 'object' && decodedToken.jti) {
            const now = Math.floor(Date.now() / 1000);
            const ttlSeconds = Math.max(decodedToken.exp - now, 0);
            await this.tokenBlacklistService.blacklistToken(decodedToken.jti, ttlSeconds);
          }
        }

        deletedCount++;
      } catch (error) {
        this.logger.error('Failed to delete session during bulk deletion', {
          userId,
          sessionId: session.sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { deletedCount };
  }

  async updatePassword(userId: string, input: IUpdatePasswordInput): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Only email users can update password
    if (user.registrationStrategy !== AuthStrategyEnum.EMAIL) {
      throw new UnauthorizedException('Password update not available for this account type');
    }

    const emailRegData = user.registrationData as IEmailRegistrationData;

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtil.verify(
      input.currentPassword,
      emailRegData.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password and update
    const newPasswordHash = await PasswordUtil.hash(input.newPassword);

    // Update password in registration data
    const updatedRegistrationData: IEmailRegistrationData = {
      ...emailRegData,
      passwordHash: newPasswordHash,
    };

    await this.usersService.updateRegistrationData(userId, updatedRegistrationData);
  }

  async getEmailValidationStatus(userId: string): Promise<IEmailValidationStatusResponse> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Return registration strategy for all users
    const response: IEmailValidationStatusResponse = {
      registrationStrategy: user.registrationStrategy,
    };

    // Only include validation status for email users
    if (user.registrationStrategy === AuthStrategyEnum.EMAIL) {
      response.isValidated = user.isEmailVerified;
    }

    return response;
  }

  async loginOrRegisterWithMetamask(
    dto: MetamaskLoginOrRegisterDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    const message = `Login to ZetikBackend`;
    const recovered: string = verifyMessage(message, dto.signature);
    if (recovered.toLowerCase() !== dto.address.toLowerCase()) {
      throw new UnauthorizedException('Invalid signature');
    }
    const user = await this.usersService.findByMetamaskAddress(dto.address);
    if (!user) {
      const newUser = await this.usersService.createWithMetamask(
        dto.address,
        dto.affiliateCampaignId,
      );
      // New user registration - no 2FA required (first session)
      const { accessToken, refreshToken } = this.generateTokens(newUser);
      return this.setAuthCookiesAndReturnTokens(newUser, response, accessToken, refreshToken);
    }
    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    // Existing user - check device and 2FA
    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const tokens = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(
      user,
      response,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }

  async loginOrRegisterWithPhantom(
    dto: PhantomLoginOrRegisterDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    const message = 'Login to ZetikBackend';

    // Handle both string (base58) and ArrayBuffer formats for backward compatibility
    let signatureBuffer: ArrayBuffer;
    try {
      if (typeof dto.signature === 'string') {
        // New format: base58 string - convert to ArrayBuffer
        const decoded = bs58.decode(dto.signature);
        // Create a new ArrayBuffer to avoid SharedArrayBuffer type issues
        signatureBuffer = new Uint8Array(decoded).buffer;
      } else {
        // Old format: ArrayBuffer - use directly
        signatureBuffer = dto.signature;
      }
    } catch {
      throw new UnauthorizedException('Invalid signature format');
    }

    const isValidSignature = verifySolanaSignature(message, signatureBuffer, dto.address);

    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    const user = await this.usersService.findByPhantomAddress(dto.address);

    if (!user) {
      const newUser = await this.usersService.createWithPhantom(
        dto.address,
        dto.affiliateCampaignId,
      );
      // New user registration - no 2FA required (first session)
      const { accessToken, refreshToken } = this.generateTokens(newUser);
      return this.setAuthCookiesAndReturnTokens(newUser, response, accessToken, refreshToken);
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    // Existing user - check device and 2FA
    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const tokens = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(
      user,
      response,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }

  /**
   * Login or register with Google (unified method)
   * If user doesn't exist - creates new user automatically
   * If user exists - performs login with 2FA check
   */
  async loginOrRegisterWithGoogle(
    dto: GoogleLoginDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    let payload: any;

    // Support both authorization code flow (recommended) and ID token flow (legacy)
    if (dto.code) {
      // Authorization Code Flow - exchange code for tokens and verify
      // Use 'postmessage' as redirect_uri for popup/iframe flow (@react-oauth/google)
      payload = await exchangeGoogleCodeForTokens(
        dto.code,
        this.googleClientId,
        this.googleClientSecret,
        'postmessage',
      );
    } else if (dto.idToken) {
      // ID Token Flow (legacy) - verify ID token directly
      payload = await verifyGoogleIdToken(dto.idToken, this.googleClientId);
    } else {
      throw new UnauthorizedException('Either code or idToken must be provided');
    }

    if (!payload) {
      throw new UnauthorizedException('Invalid Google authentication');
    }

    // Security: Verify email is verified by Google
    if (!payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const user = await this.usersService.findByGoogleId(payload.sub);
    if (!user) {
      const googleData = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        given_name: payload.given_name,
        family_name: payload.family_name,
        locale: payload.locale,
      };

      const newUser = await this.usersService.createWithGoogle(googleData);
      // New user registration - no 2FA required (first session)
      const { accessToken, refreshToken } = this.generateTokens(newUser);
      return this.setAuthCookiesAndReturnTokens(newUser, response, accessToken, refreshToken);
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    // Existing user - check device and 2FA
    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const tokens = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(
      user,
      response,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }

  private async setAuthCookiesAndReturnTokens(
    user: UserEntity,
    response: Response,
    accessToken: string,
    refreshToken: string,
    sessionId?: string,
  ): Promise<AuthResponseDto> {
    // Convert JWT expiration string to milliseconds for cookie expiration
    const accessExpirationMs = this.parseJwtExpirationToMs(this.accessExpiration);
    const refreshExpirationMs = this.parseJwtExpirationToMs(this.refreshExpiration);

    // Set secure HttpOnly cookies
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: !this.isLocalEnvironment, // Only false for localhost/http
      sameSite: this.isProduction ? 'strict' : this.isLocalEnvironment ? 'lax' : 'none',
      domain: this.isLocalEnvironment ? 'localhost' : undefined,
      maxAge: accessExpirationMs,
      path: '/',
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: !this.isLocalEnvironment, // Only false for localhost/http
      sameSite: this.isProduction ? 'strict' : this.isLocalEnvironment ? 'lax' : 'none',
      domain: this.isLocalEnvironment ? 'localhost' : undefined,
      maxAge: refreshExpirationMs,
      path: '/auth/refresh',
    });

    // Extract user-agent and device info
    const userAgentHeader = response.req?.headers?.['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : 'not available';
    const deviceInfo = this.parseDeviceInfo(userAgent);

    // Extract IP address
    const extractedIp = this.extractClientIpAddress(response.req);
    const ipAddressString = extractedIp || '127.0.0.1';

    // If sessionId not provided (legacy login methods), create session now
    if (!sessionId) {
      const tokenHash = SessionTrackingService.computeTokenHash(accessToken);
      try {
        sessionId = await this.sessionTrackingService.createSession(
          tokenHash,
          user.id,
          ipAddressString,
          deviceInfo,
        );
      } catch (error) {
        this.logger.error('Failed to create session tracking', error);
      }
    }

    // Create refresh token in DB with sessionId
    await this.refreshTokenService.createRefreshToken(
      user,
      refreshToken,
      deviceInfo,
      ipAddressString,
      sessionId,
    );

    // Extract email from registration data
    const email =
      user.registrationStrategy === AuthStrategyEnum.EMAIL
        ? (user.registrationData as { email: string }).email
        : '';

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email,
      },
    };
  }

  // Utility method to parse JWT expiration format (e.g., '15m', '7d', '24h') to milliseconds
  private parseJwtExpirationToMs(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600000; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 3600000; // Default 1 hour
    }
  }

  private generateTokens(
    user: UserEntity,
    sessionId?: string,
  ): {
    accessToken: string;
    refreshToken: string;
    tokenId: string;
    sessionId: string;
  } {
    const payload = { sub: user.id, username: user.username };
    const tokenId = randomBytes(16).toString('hex');
    const finalSessionId = sessionId || ''; // Will be set after session creation if not provided

    // Include sessionId in JWT payload for transparency and easier access
    // Note: sessionId may be empty on first login, but will be populated after session creation
    const accessPayload = { ...payload, jti: tokenId, sessionId: finalSessionId };
    const refreshPayload = { ...accessPayload, iat: Math.floor(Date.now() / 1000) };

    return {
      accessToken: this.jwtService.sign(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessExpiration,
      }),
      refreshToken: this.jwtService.sign(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiration,
      }),
      tokenId,
      sessionId: finalSessionId,
    };
  }

  async registerWithSteam(dto: SteamRegisterDto, response: Response): Promise<AuthResponseDto> {
    if (!this.steamApiKey) {
      throw new UnauthorizedException('Steam authentication not configured');
    }

    const steamData = {
      openidAssocHandle: dto.openidAssocHandle,
      openidSigned: dto.openidSigned,
      openidSig: dto.openidSig,
      openidNs: dto.openidNs,
      openidMode: dto.openidMode,
      openidOpEndpoint: dto.openidOpEndpoint,
      openidClaimedId: dto.openidClaimedId,
      openidIdentity: dto.openidIdentity,
      openidReturnTo: dto.openidReturnTo,
      openidResponseNonce: dto.openidResponseNonce,
    };

    const isValidSignature = await verifySteamOpenId(steamData);
    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid Steam OpenID signature');
    }

    const steamId = extractSteamId(dto.openidClaimedId);
    if (!steamId) {
      throw new UnauthorizedException('Invalid Steam Claimed ID');
    }

    const steamUserData = await getSteamUserData(steamId, this.steamApiKey);
    if (!steamUserData) {
      throw new UnauthorizedException('Failed to fetch Steam user data');
    }

    const user = await this.usersService.createWithSteam(steamUserData);
    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  async loginWithSteam(
    dto: SteamLoginDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    const steamData = {
      openidAssocHandle: dto.openidAssocHandle,
      openidSigned: dto.openidSigned,
      openidSig: dto.openidSig,
      openidNs: dto.openidNs,
      openidMode: dto.openidMode,
      openidOpEndpoint: dto.openidOpEndpoint,
      openidClaimedId: dto.openidClaimedId,
      openidIdentity: dto.openidIdentity,
      openidReturnTo: dto.openidReturnTo,
      openidResponseNonce: dto.openidResponseNonce,
    };

    const isValidSignature = await verifySteamOpenId(steamData);
    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid Steam OpenID signature');
    }

    const steamId = extractSteamId(dto.openidClaimedId);
    if (!steamId) {
      throw new UnauthorizedException('Invalid Steam Claimed ID');
    }

    const user = await this.usersService.findBySteamId(steamId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Check for permanent self-exclusion
    await this.checkPermanentExclusion(user.id);

    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const { accessToken, refreshToken } = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(user, response, accessToken, refreshToken);
  }

  /**
   * Verify Steam OpenID signature (call this ONCE, then use Verified methods)
   */
  async verifySteamSignature(dto: SteamLoginDto): Promise<boolean> {
    const steamData = {
      openidAssocHandle: dto.openidAssocHandle,
      openidSigned: dto.openidSigned,
      openidSig: dto.openidSig,
      openidNs: dto.openidNs,
      openidMode: dto.openidMode,
      openidOpEndpoint: dto.openidOpEndpoint,
      openidClaimedId: dto.openidClaimedId,
      openidIdentity: dto.openidIdentity,
      openidReturnTo: dto.openidReturnTo,
      openidResponseNonce: dto.openidResponseNonce,
    };

    return verifySteamOpenId(steamData);
  }

  /**
   * Login or register with Steam (signature already verified, don't verify again!)
   * If user doesn't exist - creates new user automatically
   * If user exists - performs login with 2FA check
   */
  async loginOrRegisterWithSteamVerified(
    dto: SteamLoginDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    if (!this.steamApiKey) {
      throw new UnauthorizedException('Steam authentication not configured');
    }

    const steamId = extractSteamId(dto.openidClaimedId);
    if (!steamId) {
      throw new UnauthorizedException('Invalid Steam Claimed ID');
    }

    // Try to find existing user
    const user = await this.usersService.findBySteamId(steamId);

    if (!user) {
      // User doesn't exist - auto-register
      const steamUserData = await getSteamUserData(steamId, this.steamApiKey);
      if (!steamUserData) {
        throw new UnauthorizedException('Failed to fetch Steam user data');
      }

      this.logger.log(`Creating new Steam user: ${steamId}`);
      const newUser = await this.usersService.createWithSteam(steamUserData);

      // New user registration - no 2FA required (first session)
      const { accessToken, refreshToken } = this.generateTokens(newUser);
      return this.setAuthCookiesAndReturnTokens(newUser, response, accessToken, refreshToken);
    }

    // User exists - perform login
    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    this.logger.log(`Steam login for existing user: ${steamId}`);

    // Existing user - check device and 2FA
    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const tokens = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(
      user,
      response,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }

  /**
   * Login or register with Steam (unified method)
   * If user doesn't exist - creates new user automatically
   * If user exists - performs login with 2FA check
   */
  async loginOrRegisterWithSteam(
    dto: SteamLoginDto,
    response: Response,
  ): Promise<AuthResponseDto | PendingAuthResponseDto> {
    if (!this.steamApiKey) {
      throw new UnauthorizedException('Steam authentication not configured');
    }

    const steamData = {
      openidAssocHandle: dto.openidAssocHandle,
      openidSigned: dto.openidSigned,
      openidSig: dto.openidSig,
      openidNs: dto.openidNs,
      openidMode: dto.openidMode,
      openidOpEndpoint: dto.openidOpEndpoint,
      openidClaimedId: dto.openidClaimedId,
      openidIdentity: dto.openidIdentity,
      openidReturnTo: dto.openidReturnTo,
      openidResponseNonce: dto.openidResponseNonce,
    };

    const isValidSignature = await verifySteamOpenId(steamData);
    if (!isValidSignature) {
      throw new UnauthorizedException('Invalid Steam OpenID signature');
    }

    const steamId = extractSteamId(dto.openidClaimedId);
    if (!steamId) {
      throw new UnauthorizedException('Invalid Steam Claimed ID');
    }

    // Try to find existing user
    const user = await this.usersService.findBySteamId(steamId);

    if (!user) {
      // User doesn't exist - auto-register
      const steamUserData = await getSteamUserData(steamId, this.steamApiKey);
      if (!steamUserData) {
        throw new UnauthorizedException('Failed to fetch Steam user data');
      }

      this.logger.log(`Creating new Steam user: ${steamId}`);
      const newUser = await this.usersService.createWithSteam(steamUserData);

      // New user registration - no 2FA required (first session)
      const { accessToken, refreshToken } = this.generateTokens(newUser);
      return this.setAuthCookiesAndReturnTokens(newUser, response, accessToken, refreshToken);
    }

    // User exists - perform login
    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    this.logger.log(`Steam login for existing user: ${steamId}`);

    // Existing user - check device and 2FA
    const pending2FA = await this.checkDeviceAndRequire2FA(user, response);
    if (pending2FA) {
      return pending2FA;
    }

    const tokens = this.generateTokens(user);
    return this.setAuthCookiesAndReturnTokens(
      user,
      response,
      tokens.accessToken,
      tokens.refreshToken,
    );
  }

  /**
   * Build Steam OpenID authentication URL
   * @returns Steam OpenID URL for user to authenticate
   */
  buildSteamOpenIdUrl(): string {
    if (!this.steamRealm) {
      throw new UnauthorizedException('Steam authentication not configured');
    }

    const returnTo = `${this.steamRealm}/v1/auth/steam/callback`;
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': this.steamRealm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    return `https://steamcommunity.com/openid/login?${params.toString()}`;
  }

  /**
   * Link Google account to existing user
   */
  async linkGoogleAccount(userId: string, dto: GoogleLoginDto): Promise<void> {
    if (!dto.idToken) {
      throw new UnauthorizedException('ID token is required for linking Google account');
    }

    const payload = await verifyGoogleIdToken(dto.idToken, this.googleClientId);
    if (!payload) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if this Google account is already linked to another user
    const existingUserWithGoogle = await this.usersService.findByGoogleId(payload.sub);
    if (existingUserWithGoogle && existingUserWithGoogle.id !== userId) {
      throw new BadRequestException('This Google account is already linked to another user');
    }

    // Check if user already has a Google account linked
    if (user.registrationStrategy === AuthStrategyEnum.GOOGLE) {
      throw new BadRequestException('User already has a Google account linked');
    }

    // Create secondary Google registration data and link it
    const googleData = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      locale: payload.locale,
    };

    await this.usersService.linkGoogleAccount(userId, googleData);
  }

  /**
   * Unlink Google account from user
   */
  async unlinkGoogleAccount(userId: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User must have a primary authentication method other than Google
    if (user.registrationStrategy === AuthStrategyEnum.GOOGLE) {
      throw new BadRequestException(
        'Cannot unlink Google account as it is your primary authentication method',
      );
    }

    await this.usersService.unlinkGoogleAccount(userId);
  }

  /**
   * Get Google account link status for user
   */
  async getGoogleLinkStatus(userId: string): Promise<{ linked: boolean; email?: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const googleLinked = await this.usersService.isGoogleLinked(userId);
    if (googleLinked) {
      const googleData = await this.usersService.getLinkedGoogleData(userId);
      return {
        linked: true,
        email: googleData?.email,
      };
    }

    return { linked: false };
  }

  /**
   * Extract client IP address from request
   * Handles various proxy headers and fallbacks
   */
  private extractClientIpAddress(request: any): string | null {
    if (!request) return null;

    // Try various headers that might contain the real IP
    // Priority: VPN/Proxy headers → Standard headers → Connection info
    const ipSources = [
      // VPN and proxy-specific headers
      request.headers['cf-connecting-ip'], // Cloudflare
      request.headers['x-real-ip'], // Nginx, VPN, Proxy
      request.headers['x-forwarded-for'], // Standard proxy header (can have multiple IPs)
      request.headers['x-client-ip'], // Apache
      request.headers['x-forwarded'], // General forwarded
      request.headers['x-originating-ip'], // Some proxies
      request.headers['x-cluster-client-ip'], // Rackspace
      request.headers['x-remote-ip'], // Some VPN services
      request.headers['forwarded-for'], // RFC 7239
      request.headers['forwarded'], // RFC 7239
      request.connection?.remoteAddress, // Direct connection
      request.socket?.remoteAddress, // Socket connection
      request.ip, // Express.js parsed IP
    ];

    for (const ipSource of ipSources) {
      if (ipSource) {
        // Handle comma-separated IPs (x-forwarded-for can contain multiple IPs)
        const ip = typeof ipSource === 'string' ? ipSource.split(',')[0].trim() : String(ipSource);

        // Validate IP format and exclude local IPs for production
        if (this.isValidIpAddress(ip)) {
          return ip;
        }
      }
    }

    return null;
  }

  /**
   * Validate if a string is a valid IP address
   * Also excludes certain local/private ranges that won't work with geolocation
   */
  private isValidIpAddress(ip: string): boolean {
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
      // Allow localhost in development, but note it won't have location data
      return !this.isProduction;
    }

    // Basic IPv4 regex
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // Basic IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if user has permanent self-exclusion and throw error if they do
   * @param userId User ID to check
   * @throws UnauthorizedException if user has permanent self-exclusion
   */
  private async checkPermanentExclusion(userId: string): Promise<void> {
    const permanentExclusion = await this.selfExclusionService.getActiveSelfExclusions(userId);

    const hasPermanentExclusion = permanentExclusion.some(
      (exclusion) => exclusion.type === SelfExclusionTypeEnum.PERMANENT,
    );

    if (hasPermanentExclusion) {
      throw new UnauthorizedException(
        'You have permanently self-excluded from this platform. Please contact support if you need assistance.',
      );
    }
  }

  /**
   * Parse user agent string to extract readable device information
   * @param userAgent The user agent string
   * @returns Formatted device information string
   */
  private parseDeviceInfo(userAgent: string): string {
    if (!userAgent || userAgent === 'not available') {
      return 'Unknown Device';
    }

    try {
      // Mobile devices
      if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
        // iOS devices
        if (/iPhone/i.test(userAgent)) {
          return 'iPhone';
        } else if (/iPad/i.test(userAgent)) {
          return 'iPad';
        } else if (/iPod/i.test(userAgent)) {
          return 'iPod';
        }
        // Android devices
        else if (/Android/i.test(userAgent)) {
          const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)?)/);
          const androidVersion = androidMatch ? androidMatch[1] : '';
          return `Android${androidVersion ? ' ' + androidVersion : ''}`;
        }
        // Other mobile
        else {
          return 'Mobile Device';
        }
      }

      // Desktop browsers
      let browser = 'Unknown Browser';
      let os = 'Unknown OS';

      // Detect browser
      if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) {
        browser = 'Chrome';
      } else if (/Firefox/i.test(userAgent)) {
        browser = 'Firefox';
      } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
        browser = 'Safari';
      } else if (/Edg/i.test(userAgent)) {
        browser = 'Edge';
      } else if (/Opera|OPR/i.test(userAgent)) {
        browser = 'Opera';
      }

      // Detect OS
      if (/Windows NT/i.test(userAgent)) {
        const windowsMatch = userAgent.match(/Windows NT (\d+(?:\.\d+)?)/);
        const windowsVersion = windowsMatch ? windowsMatch[1] : '';
        if (windowsVersion === '10.0') os = 'Windows 10';
        else if (windowsVersion === '6.3') os = 'Windows 8.1';
        else if (windowsVersion === '6.2') os = 'Windows 8';
        else if (windowsVersion === '6.1') os = 'Windows 7';
        else os = 'Windows';
      } else if (/Mac OS X/i.test(userAgent)) {
        os = 'macOS';
      } else if (/Linux/i.test(userAgent)) {
        os = 'Linux';
      } else if (/CrOS/i.test(userAgent)) {
        os = 'Chrome OS';
      }

      return `${browser} on ${os}`;
    } catch (error) {
      this.logger.warn('Failed to parse user agent:', userAgent, error);
      return 'Unknown Device';
    }
  }
}
