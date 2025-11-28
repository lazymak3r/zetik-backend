import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../../common/services/redis.service';

interface IPendingAuthData {
  userId: string;
  ipAddress: string;
  deviceInfo: string;
}

function validatePendingAuthData(data: any): data is IPendingAuthData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.userId === 'string' &&
    typeof data.ipAddress === 'string' &&
    typeof data.deviceInfo === 'string'
  );
}

@Injectable()
export class PendingAuthTokenService {
  private readonly logger = new Logger(PendingAuthTokenService.name);
  private readonly PENDING_AUTH_PREFIX: string;
  private readonly TOKEN_TTL_SECONDS: number;
  private readonly RATE_LIMIT_PREFIX: string;
  private readonly MAX_ATTEMPTS: number;
  private readonly RATE_LIMIT_WINDOW_SECONDS: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.PENDING_AUTH_PREFIX = this.configService.get<string>(
      'security.pendingAuth.tokenPrefix',
      'pending-auth:',
    );
    this.TOKEN_TTL_SECONDS = this.configService.get<number>(
      'security.pendingAuth.tokenTtlSeconds',
      300,
    );
    this.RATE_LIMIT_PREFIX = this.configService.get<string>(
      'security.pendingAuth.rateLimitPrefix',
      'pending-auth-rate:',
    );
    this.MAX_ATTEMPTS = this.configService.get<number>('security.pendingAuth.maxAttempts', 10);
    this.RATE_LIMIT_WINDOW_SECONDS = this.configService.get<number>(
      'security.pendingAuth.rateLimitWindowSeconds',
      900,
    );
  }

  async createPendingAuthToken(data: IPendingAuthData): Promise<string> {
    const rateLimitKey = `${this.RATE_LIMIT_PREFIX}${data.userId}:${data.ipAddress}`;
    const attemptsStr = await this.redisService.get(rateLimitKey);
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (attempts >= this.MAX_ATTEMPTS) {
      this.logger.warn('Pending auth token creation rate limit exceeded', {
        userId: data.userId,
        ipAddress: data.ipAddress,
        attempts,
      });
      throw new HttpException(
        'Too many authentication attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redisService.set(
      rateLimitKey,
      (attempts + 1).toString(),
      this.RATE_LIMIT_WINDOW_SECONDS,
    );

    const token = this.generateSecureToken();
    const key = this.getPendingAuthKey(token);

    await this.redisService.set(key, JSON.stringify(data), this.TOKEN_TTL_SECONDS);

    return token;
  }

  async validateAndConsumePendingAuthToken(token: string): Promise<IPendingAuthData> {
    const key = this.getPendingAuthKey(token);
    const data = await this.redisService.get(key);

    if (!data) {
      throw new UnauthorizedException('Authentication failed');
    }

    await this.redisService.del(key);

    let parsedData: any;
    try {
      parsedData = JSON.parse(data);
    } catch (error) {
      this.logger.error('Failed to parse pending auth data', { error });
      throw new UnauthorizedException('Authentication failed');
    }

    if (!validatePendingAuthData(parsedData)) {
      this.logger.error('Invalid pending auth data structure', { parsedData });
      throw new UnauthorizedException('Authentication failed');
    }

    return parsedData;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  private getPendingAuthKey(token: string): string {
    return `${this.PENDING_AUTH_PREFIX}${token}`;
  }
}
