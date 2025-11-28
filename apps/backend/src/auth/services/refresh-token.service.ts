import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RefreshTokenEntity, UserEntity } from '@zetik/shared-entities';
import * as geoip from 'geoip-lite';
import { LessThan, Not, Repository } from 'typeorm';
import { authConfig } from '../../config/auth.config';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
  ) {}

  async createRefreshToken(
    user: UserEntity,
    tokenValue: string,
    userAgent: string | undefined,
    ipAddress: string,
    sessionId?: string,
  ): Promise<RefreshTokenEntity> {
    // Calculate expiration time based on config
    const expirationString = authConfig().refreshExpiration;
    const expiresAt = this.calculateExpirationDate(expirationString);

    const now = new Date();
    const location = this.getLocationFromIP(ipAddress);

    const refreshToken = this.refreshTokenRepository.create({
      userId: user.id,
      token: tokenValue,
      expiresAt,
      deviceInfo: userAgent,
      lastUse: now,
      ipAddress,
      location,
      sessionId,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async findTokenByValue(
    token: string,
    updateLastUse = false,
    ipAddress: string,
  ): Promise<RefreshTokenEntity | null> {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: {
        token,
      },
      relations: ['user'],
    });

    if (tokenEntity && updateLastUse) {
      tokenEntity.lastUse = new Date();
      tokenEntity.ipAddress = ipAddress;
      await this.refreshTokenRepository.save(tokenEntity);
    }

    return tokenEntity;
  }

  async save(tokenEntity: RefreshTokenEntity): Promise<RefreshTokenEntity> {
    return this.refreshTokenRepository.save(tokenEntity);
  }

  /**
   * Get session ID by token value
   * @param token The refresh token value
   * @returns The session ID or undefined if not found
   */
  async getSessionIdByToken(token: string): Promise<number | undefined> {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token },
      select: ['id'],
    });

    return tokenEntity?.id;
  }

  async revokeToken(tokenId: number): Promise<void> {
    await this.refreshTokenRepository.delete(tokenId);
  }

  async revokeAllUserTokens(userId: string): Promise<string[]> {
    // First find all tokens to get their values
    const tokensToDelete = await this.refreshTokenRepository.find({
      where: { userId },
    });

    if (tokensToDelete.length === 0) {
      return [];
    }

    // Store the token values
    const tokenValues = tokensToDelete.map((token) => token.token);

    // Delete the tokens
    await this.refreshTokenRepository.delete({ userId });

    return tokenValues;
  }

  async deleteExpiredTokens(): Promise<void> {
    const now = new Date();
    await this.refreshTokenRepository.delete({
      expiresAt: LessThan(now),
    });
  }

  /**
   * Get all active sessions for a user
   * @param userId The user ID to get sessions for
   * @returns Array of refresh tokens representing active sessions
   */
  async getUserSessions(userId: string): Promise<RefreshTokenEntity[]> {
    const now = new Date();
    return this.refreshTokenRepository.find({
      where: {
        userId,
        expiresAt: Not(LessThan(now)), // Only get non-expired tokens
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Delete a specific session by ID
   * @param userId The user ID the session belongs to
   * @param sessionId The ID of the session to delete
   * @returns Object containing the deleted token value and count
   */
  async deleteSessionById(
    userId: string,
    refreshTokenId: number,
  ): Promise<{ token?: string; sessionId?: string; deletedCount: number }> {
    // First find the token to get its value
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: {
        userId,
        id: refreshTokenId,
      },
    });

    if (!tokenEntity) {
      return { deletedCount: 0 };
    }

    // Store the token value and sessionId
    const tokenValue = tokenEntity.token;
    const sessionId = tokenEntity.sessionId;

    // Delete the token
    const result = await this.refreshTokenRepository.delete({
      userId,
      id: refreshTokenId,
    });

    return {
      token: tokenValue,
      sessionId,
      deletedCount: result.affected || 0,
    };
  }

  async findTokenBySessionId(sessionId: string): Promise<RefreshTokenEntity | null> {
    return this.refreshTokenRepository.findOne({ where: { sessionId } });
  }

  async deleteSessionBySessionId(
    userId: string,
    sessionId: string,
  ): Promise<{ token?: string; deletedCount: number }> {
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: {
        userId,
        sessionId,
      },
    });

    if (!tokenEntity) {
      return { deletedCount: 0 };
    }

    const tokenValue = tokenEntity.token;

    const result = await this.refreshTokenRepository.delete({
      userId,
      sessionId,
    });

    return {
      token: tokenValue,
      deletedCount: result.affected || 0,
    };
  }

  /**
   * Delete all sessions for a user except the specified one
   * @param userId The user ID to delete sessions for
   * @param keepSessionId The ID of the token to keep
   * @returns Object containing the deleted token values and count
   */
  async deleteAllSessionsExceptCurrent(
    userId: string,
    keepSessionId: number,
  ): Promise<{ tokens: string[]; deletedCount: number }> {
    // First find all tokens to get their values
    const tokensToDelete = await this.refreshTokenRepository.find({
      where: {
        userId,
        id: Not(keepSessionId),
      },
    });

    if (tokensToDelete.length === 0) {
      return { tokens: [], deletedCount: 0 };
    }

    // Store the token values
    const tokenValues = tokensToDelete.map((token) => token.token);

    // Delete the tokens
    const result = await this.refreshTokenRepository.delete({
      userId,
      id: Not(keepSessionId),
    });

    return {
      tokens: tokenValues,
      deletedCount: result.affected || 0,
    };
  }

  /**
   * Check if a device/IP combination has been used before by this user
   * @param userId The user ID to check
   * @param ipAddress The IP address to check
   * @param deviceInfo The device info (user agent) to check
   * @returns true if this device/IP combination has active sessions
   */
  async isKnownDevice(userId: string, ipAddress: string, deviceInfo: string): Promise<boolean> {
    const now = new Date();

    const existingSession = await this.refreshTokenRepository.findOne({
      where: {
        userId,
        ipAddress,
        deviceInfo,
        expiresAt: Not(LessThan(now)),
      },
    });

    return !!existingSession;
  }

  /**
   * Get location information from IP address using geoip-lite
   * @param ipAddress The IP address to get location for
   * @returns Location string or "Unknown" if no data available
   */
  private getLocationFromIP(ipAddress: string): string {
    try {
      // Handle localhost/development cases
      if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress === 'localhost') {
        return 'Local Development';
      }

      // Handle private IP ranges that won't have geo data
      if (this.isPrivateIP(ipAddress)) {
        return 'Private Network';
      }

      const geo = geoip.lookup(ipAddress);
      let location = 'Unknown Location';

      if (geo && geo.city && geo.country) {
        location = `${geo.city}, ${geo.country}`;
      } else if (geo && geo.country) {
        location = geo.country;
      } else if (geo && geo.region) {
        location = geo.region;
      }

      return location;
    } catch (error) {
      this.logger.warn(`Failed to lookup location for IP ${ipAddress}:`, error);
      return 'Unknown Location';
    }
  }

  /**
   * Check if an IP address is in a private range
   * @param ip The IP address to check
   * @returns true if the IP is in a private range
   */
  private isPrivateIP(ip: string): boolean {
    // Private IPv4 ranges:
    // 10.0.0.0 - 10.255.255.255
    // 172.16.0.0 - 172.31.255.255
    // 192.168.0.0 - 192.168.255.255

    const ipParts = ip.split('.').map(Number);
    if (ipParts.length !== 4 || ipParts.some((part) => isNaN(part))) {
      return false; // Not a valid IPv4 address
    }

    const [a, b] = ipParts;

    return (
      a === 10 || // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) // 192.168.0.0/16
    );
  }

  // Helper function to calculate expiration date from JWT time string (e.g., '7d', '30m')
  private calculateExpirationDate(expirationString: string = '7d'): Date {
    const now = new Date();
    const match = expirationString.match(/^(\d+)([smhd])$/);

    if (!match) {
      // Default to 7 days if format is not recognized
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
}
