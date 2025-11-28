import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AssetTypeEnum, UserEntity } from '@zetik/shared-entities';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { BalanceService } from '../../balance/balance.service';
import { RedisService } from '../../common/services/redis.service';
import { UserCacheService } from '../../common/services/user-cache.service';
import { authConfig } from '../../config/auth.config';
import { UsersService } from '../../users/users.service';
import { SessionTrackingService } from '../services/session-tracking.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';

interface CookieWithAccessToken {
  access_token?: string;
}

interface UserContextCache {
  user: UserEntity;
  primaryAsset: AssetTypeEnum | null;
  cachedAt: number;
}

interface UserWithPrimaryAsset extends UserEntity {
  primaryAsset?: AssetTypeEnum;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly CACHE_KEY_PREFIX = 'jwt-user:';
  private readonly TTL_SECONDS = 5 * 60; // 5 minutes

  constructor(
    private readonly usersService: UsersService,
    private readonly balanceService: BalanceService,
    private readonly redisService: RedisService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly userCacheService: UserCacheService,
    private readonly sessionTrackingService: SessionTrackingService,
  ) {
    const secretKey = authConfig().secret;
    if (!secretKey) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          if (!request || !request.cookies) return null;
          const cookies = request.cookies as CookieWithAccessToken;
          return cookies.access_token || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: secretKey,
      passReqToCallback: true, // ✅ Pass Request to validate()
    });
  }

  async validate(
    req: Request,
    payload: {
      sub: string;
      username: string;
      jti?: string;
    },
  ): Promise<UserWithPrimaryAsset> {
    // Check if token is blacklisted
    if (payload.jti) {
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    }

    // Track session activity using access token hash
    const accessToken = this.extractAccessToken(req);
    if (accessToken) {
      const tokenHash = SessionTrackingService.computeTokenHash(accessToken);
      const ipAddress = this.extractIpAddress(req);
      if (ipAddress) {
        this.sessionTrackingService.updateActivity(tokenHash, ipAddress).catch((error) => {
          this.logger.warn(`Failed to update session activity: ${error.message}`);
        });
      }
    }

    const userId = payload.sub;
    const cacheKey = this.getCacheKey(userId);

    // Try cache first
    const cachedData = await this.getFromCache(cacheKey);
    if (cachedData) {
      if (cachedData.user.isBanned) {
        throw new UnauthorizedException('User is banned');
      }

      const user = cachedData.user as UserWithPrimaryAsset;
      if (cachedData.primaryAsset) {
        user.primaryAsset = cachedData.primaryAsset;
      }
      return user;
    }

    // Cache miss - fetch from database
    const userContext = await this.fetchUserContextFromDB(userId);
    if (!userContext) {
      throw new UnauthorizedException('User not found');
    }

    if (userContext.user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Cache result asynchronously
    this.setCacheAsync(cacheKey, userContext);

    const user = userContext.user as UserWithPrimaryAsset;
    if (userContext.primaryAsset) {
      user.primaryAsset = userContext.primaryAsset;
    }
    return user;
  }

  private async fetchUserContextFromDB(userId: string): Promise<UserContextCache | null> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        return null;
      }

      const primaryWallet = await this.balanceService.getPrimaryWallet(userId);
      let primaryAsset: AssetTypeEnum | null = primaryWallet?.asset || null;

      // If no primary asset, default to first wallet with balance or BTC
      if (!primaryAsset) {
        const allWallets = await this.balanceService.getWallets(userId);

        // Try to find wallet with balance > 0
        const walletWithBalance = allWallets.find((w) => parseFloat(w.balance) > 0);

        if (walletWithBalance) {
          primaryAsset = walletWithBalance.asset;
        } else {
          // Default to BTC if no wallets have balance
          primaryAsset = AssetTypeEnum.BTC;
        }

        this.logger.log(`No primary asset found for user ${userId}, defaulting to ${primaryAsset}`);
      }

      return {
        user,
        primaryAsset,
        cachedAt: Date.now(),
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user context for ${userId}:`, error);
      return null;
    }
  }

  private async getFromCache(cacheKey: string): Promise<UserContextCache | null> {
    const cachedString = await this.redisService.get(cacheKey);
    if (!cachedString) {
      return null;
    }

    const cachedData = JSON.parse(cachedString);
    const now = Date.now();
    const cacheAge = now - cachedData.timestamp;

    if (cacheAge > this.TTL_SECONDS * 1000) {
      return null;
    }

    return cachedData;
  }

  private setCacheAsync(cacheKey: string, userContext: UserContextCache): void {
    const cacheData = {
      ...userContext,
      cachedAt: Date.now(),
    };

    this.redisService.set(cacheKey, JSON.stringify(cacheData), this.TTL_SECONDS).catch((error) => {
      this.logger.error(`Failed to set cache for user ${cacheKey}:`, error);
    });
  }

  private getCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}${userId}`;
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.userCacheService.invalidateJwtCache(userId);
  }

  private extractAccessToken(req?: Request): string | null {
    if (!req) {
      return null;
    }

    // Check cookies first
    if (req.cookies) {
      const cookies = req.cookies as CookieWithAccessToken;
      if (cookies.access_token) {
        return cookies.access_token;
      }
    }

    // Check Authorization header
    const authHeader = req.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    return null;
  }

  private extractIpAddress(req?: Request): string {
    if (!req) {
      return '127.0.0.1';
    }

    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
      return ips[0].trim();
    }

    const realIp = req.headers?.['x-real-ip'];
    if (realIp) {
      return typeof realIp === 'string' ? realIp : realIp[0];
    }

    return req.socket?.remoteAddress || '127.0.0.1';
  }
}
