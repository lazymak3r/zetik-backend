import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '@zetik/shared-entities';
import { randomUUID } from 'crypto';
import { sportsbookConfig } from '../config/sportsbook.config';

export interface BetbyJwtPayload {
  /**
   * Unique brand ID
   */
  iss: string;
  /**
   * Unique ID of player
   */
  sub: string;
  /**
   * Player username for Betby Backoffice
   */
  name: string;
  /**
   * Issued at timestamp
   */
  iat: number;
  /**
   * Expiration timestamp
   */
  exp: number;
  /**
   * Unique JWT token ID
   */
  jti: string;
  /**
   * Language code
   */
  lang: string;
  /**
   * User's currency code
   */
  currency: string;
  /**
   * Optional: Format of coefficients
   */
  odds_format?: string;
  ff?: {
    is_cashout_available?: boolean;
    is_match_tracker_available?: boolean;
  };
}

export interface BetbyJwtOptions {
  expiresIn?: string;
  language?: string;
  currency?: string;
  oddsFormat?: string;
  featureFlags?: {
    isCashoutAvailable?: boolean;
    isMatchTrackerAvailable?: boolean;
  };
}

@Injectable()
export class BetbyJwtService {
  private readonly logger = new Logger(BetbyJwtService.name);
  private readonly config = sportsbookConfig().betby;

  constructor(private readonly jwtService: JwtService) {}

  async generateToken(
    user: UserEntity,
    options: BetbyJwtOptions = {},
  ): Promise<{
    token: string;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = options.expiresIn || '1h';

    const expirationSeconds = this.parseExpirationToSeconds(expiresIn);
    const exp = now + expirationSeconds;

    const payload: BetbyJwtPayload = {
      iss: this.config.brandId,
      sub: user.id,
      name: user.username,
      iat: now,
      exp,
      jti: randomUUID(),
      lang: options.language || 'en',
      currency: user.currentCurrency || 'USD',
      odds_format: options.oddsFormat || 'decimal',
      ff: {
        is_cashout_available: options.featureFlags?.isCashoutAvailable ?? true,
        is_match_tracker_available: options.featureFlags?.isMatchTrackerAvailable ?? true,
      },
    };

    try {
      const privateKeyPem = this.normalizePrivateKey(this.config.localPrivateKey);

      const token = await this.jwtService.signAsync(payload, {
        algorithm: 'ES256',
        privateKey: privateKeyPem,
      });

      this.logger.debug(`Generated Betby JWT token for user ${user.id}`, {
        userId: user.id,
        username: user.username,
        expiresAt: new Date(exp * 1000).toISOString(),
        jti: payload.jti,
      });

      return {
        token,
      };
    } catch (error) {
      this.logger.error(`Failed to generate Betby JWT token for user ${user.id}`, error);
      throw new Error(
        `Failed to generate Betby JWT token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  decodeToken(token: string): BetbyJwtPayload {
    try {
      const payload = this.jwtService.decode(token);
      return payload;
    } catch (error) {
      this.logger.error(`Failed to decode Betby JWT token`, error);
      throw new Error(
        `Failed to decode Betby JWT token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      const now = Math.floor(Date.now() / 1000);
      return payload.exp < now;
    } catch (error) {
      this.logger.error(`Failed to check token expiration`, error);
      return true;
    }
  }

  private parseExpirationToSeconds(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }

  private normalizePrivateKey(privateKey: string): string {
    try {
      if (privateKey.includes('BEGIN PRIVATE KEY') || privateKey.includes('BEGIN EC PRIVATE KEY')) {
        return privateKey;
      }

      const decodedKey = Buffer.from(privateKey, 'base64').toString('utf-8');

      if (decodedKey.includes('BEGIN PRIVATE KEY') || decodedKey.includes('BEGIN EC PRIVATE KEY')) {
        return decodedKey;
      }

      return privateKey;
    } catch (error) {
      this.logger.warn('Failed to normalize private key, using as-is', error);
      return privateKey;
    }
  }
}
