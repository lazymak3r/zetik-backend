import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../common/services/redis.service';
import { authConfig } from '../../config/auth.config';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly BLACKLIST_PREFIX = 'token-blacklist:';
  private readonly accessExpiration: string;

  constructor(private readonly redisService: RedisService) {
    this.accessExpiration = authConfig().accessExpiration;
  }

  /**
   * Add a token to the blacklist
   * @param tokenId The unique identifier of the token to blacklist
   * @param ttlSeconds Optional TTL in seconds (defaults to access token expiration)
   * @returns True if the token was successfully blacklisted
   */
  async blacklistToken(tokenId: string, ttlSeconds?: number): Promise<boolean> {
    try {
      // Use provided TTL or parse from accessExpiration
      const ttl = ttlSeconds ?? this.parseJwtExpirationToSeconds(this.accessExpiration);

      // Add token to blacklist with TTL equal to the remaining token lifetime
      const key = this.getBlacklistKey(tokenId);
      const result = await this.redisService.set(key, 'blacklisted', ttl);

      if (!result) {
        this.logger.warn(`Failed to add token ${tokenId} to blacklist`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Error blacklisting token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Check if a token is blacklisted
   * @param tokenId The unique identifier of the token to check
   * @returns True if the token is blacklisted
   */
  async isBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const key = this.getBlacklistKey(tokenId);
      const result = await this.redisService.get(key);
      return result !== null;
    } catch (error) {
      this.logger.error(`Error checking blacklist for token ${tokenId}:`, error);
      return false;
    }
  }

  /**
   * Get the Redis key for a blacklisted token
   * @param tokenId The token ID
   * @returns The Redis key
   */
  private getBlacklistKey(tokenId: string): string {
    return `${this.BLACKLIST_PREFIX}${tokenId}`;
  }

  /**
   * Parse JWT expiration format (e.g., '15m', '7d', '24h') to seconds
   * @param expiration The JWT expiration string
   * @returns The expiration time in seconds
   */
  private parseJwtExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600; // Default 1 hour
    }
  }
}
