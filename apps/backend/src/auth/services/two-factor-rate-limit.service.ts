import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/services/redis.service';

@Injectable()
export class TwoFactorRateLimitService {
  private readonly logger = new Logger(TwoFactorRateLimitService.name);
  private readonly RATE_LIMIT_PREFIX: string;
  private readonly MAX_ATTEMPTS: number;
  private readonly RATE_LIMIT_WINDOW_SECONDS: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.RATE_LIMIT_PREFIX = this.configService.get<string>(
      'security.twoFactor.rateLimitPrefix',
      '2fa-attempts:',
    );
    this.MAX_ATTEMPTS = this.configService.get<number>(
      'security.twoFactor.rateLimitMaxAttempts',
      5,
    );
    this.RATE_LIMIT_WINDOW_SECONDS = this.configService.get<number>(
      'security.twoFactor.rateLimitWindowSeconds',
      900,
    );
  }

  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remainingAttempts?: number }> {
    const key = `${this.RATE_LIMIT_PREFIX}${userId}`;
    const attemptsStr = await this.redisService.get(key);
    const parsedAttempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    const attempts = isNaN(parsedAttempts) ? 0 : parsedAttempts;

    if (attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn('2FA rate limit exceeded', { userId, attempts });
      return { allowed: false };
    }

    return { allowed: true, remainingAttempts: this.MAX_ATTEMPTS - attempts };
  }

  async incrementAttempts(userId: string): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${userId}`;
    const attemptsStr = await this.redisService.get(key);
    const parsedAttempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
    const attempts = isNaN(parsedAttempts) ? 0 : parsedAttempts;
    const newAttempts = attempts + 1;

    await this.redisService.set(key, newAttempts.toString(), this.RATE_LIMIT_WINDOW_SECONDS);

    if (newAttempts >= this.MAX_ATTEMPTS) {
      this.logger.warn('User hit 2FA rate limit', { userId, attempts: newAttempts });
    }
  }

  async resetAttempts(userId: string): Promise<void> {
    const key = `${this.RATE_LIMIT_PREFIX}${userId}`;
    await this.redisService.del(key);
  }
}
