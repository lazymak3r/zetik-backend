import { ForbiddenException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '@zetik/shared-entities';
import { authenticator } from 'otplib';
import { RedisService } from '../../common/services/redis.service';
import { TwoFactorRateLimitService } from './two-factor-rate-limit.service';

export const TWO_FACTOR_CODE_LENGTH = 6;

@Injectable()
export class TwoFactorValidationService {
  private readonly logger = new Logger(TwoFactorValidationService.name);
  private readonly USED_TOKEN_PREFIX: string;
  private readonly TOKEN_TTL_SECONDS: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly rateLimitService: TwoFactorRateLimitService,
    private readonly configService: ConfigService,
  ) {
    this.USED_TOKEN_PREFIX = this.configService.get<string>(
      'security.twoFactor.usedTokenPrefix',
      '2fa-used:',
    );
    this.TOKEN_TTL_SECONDS = this.configService.get<number>(
      'security.twoFactor.tokenTtlSeconds',
      180,
    );
  }

  async verifyTwoFactorAuthenticationToken(
    token: string,
    secret: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const rateLimitCheck = await this.rateLimitService.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        throw new HttpException(
          'Too many authentication attempts. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const sanitizedToken = token.trim().replace(/\s/g, '');

      const usedTokenKey = `${this.USED_TOKEN_PREFIX}${userId}:${sanitizedToken}`;
      const wasClaimed = await this.redisService.setNX(usedTokenKey, '1', this.TOKEN_TTL_SECONDS);

      if (!wasClaimed) {
        this.logger.warn('2FA token was already used (replay attack detected)', { userId });
        await this.rateLimitService.incrementAttempts(userId);
        return false;
      }

      const isValid = authenticator.verify({ token: sanitizedToken, secret });
      if (!isValid) {
        await this.redisService.del(usedTokenKey);
        await this.rateLimitService.incrementAttempts(userId);
        return false;
      }

      await this.rateLimitService.resetAttempts(userId);
      return true;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 429) {
        throw error;
      }
      this.logger.error('2FA token verification failed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async validateUserTwoFactor(user: UserEntity, twoFactorCode?: string): Promise<void> {
    if (!user.is2FAEnabled) {
      return;
    }

    if (!twoFactorCode) {
      throw new ForbiddenException({
        message: '2FA code is required',
        error: 'TwoFactorCodeMissing',
        statusCode: 403,
      });
    }

    if (!user.twoFactorSecret) {
      throw new ForbiddenException({
        message: '2FA is not properly configured',
        error: 'TwoFactorMisconfigured',
        statusCode: 403,
      });
    }

    const isValid = await this.verifyTwoFactorAuthenticationToken(
      twoFactorCode,
      user.twoFactorSecret,
      user.id,
    );

    if (!isValid) {
      throw new ForbiddenException({
        message: 'Invalid 2FA code',
        error: 'TwoFactorCodeInvalid',
        statusCode: 403,
      });
    }
  }
}
