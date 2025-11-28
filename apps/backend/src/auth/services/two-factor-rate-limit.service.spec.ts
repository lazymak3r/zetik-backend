import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/services/redis.service';
import { TwoFactorRateLimitService } from './two-factor-rate-limit.service';

describe('TwoFactorRateLimitService', () => {
  let service: TwoFactorRateLimitService;
  let redisService: jest.Mocked<RedisService>;

  const userId = 'test-user-id';
  const rateLimitKey = `2fa-attempts:${userId}`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorRateLimitService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: any) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorRateLimitService>(TwoFactorRateLimitService);
    redisService = module.get(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow request when no attempts recorded', async () => {
      redisService.get.mockResolvedValue(null);

      const result = await service.checkRateLimit(userId);

      expect(result).toEqual({ allowed: true, remainingAttempts: 5 });
      expect(redisService.get).toHaveBeenCalledWith(rateLimitKey);
    });

    it('should allow request when attempts below limit', async () => {
      redisService.get.mockResolvedValue('3');

      const result = await service.checkRateLimit(userId);

      expect(result).toEqual({ allowed: true, remainingAttempts: 2 });
    });

    it('should block request when attempts at limit', async () => {
      redisService.get.mockResolvedValue('5');

      const result = await service.checkRateLimit(userId);

      expect(result).toEqual({ allowed: false });
    });

    it('should block request when attempts exceed limit', async () => {
      redisService.get.mockResolvedValue('10');

      const result = await service.checkRateLimit(userId);

      expect(result).toEqual({ allowed: false });
    });

    it('should handle non-numeric values gracefully', async () => {
      redisService.get.mockResolvedValue('invalid');

      const result = await service.checkRateLimit(userId);

      expect(result).toEqual({ allowed: true, remainingAttempts: 5 });
    });
  });

  describe('incrementAttempts', () => {
    it('should increment attempts from 0 to 1', async () => {
      redisService.get.mockResolvedValue(null);

      await service.incrementAttempts(userId);

      expect(redisService.set).toHaveBeenCalledWith(rateLimitKey, '1', 900);
    });

    it('should increment existing attempts', async () => {
      redisService.get.mockResolvedValue('2');

      await service.incrementAttempts(userId);

      expect(redisService.set).toHaveBeenCalledWith(rateLimitKey, '3', 900);
    });

    it('should set TTL of 15 minutes (900 seconds)', async () => {
      redisService.get.mockResolvedValue(null);

      await service.incrementAttempts(userId);

      expect(redisService.set).toHaveBeenCalledWith(expect.any(String), expect.any(String), 900);
    });

    it('should log warning when hitting rate limit', async () => {
      redisService.get.mockResolvedValue('4');
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      await service.incrementAttempts(userId);

      expect(loggerWarnSpy).toHaveBeenCalledWith('User hit 2FA rate limit', {
        userId,
        attempts: 5,
      });
    });
  });

  describe('resetAttempts', () => {
    it('should delete the rate limit key', async () => {
      await service.resetAttempts(userId);

      expect(redisService.del).toHaveBeenCalledWith(rateLimitKey);
    });
  });

  describe('rate limit workflow', () => {
    it('should properly track multiple failed attempts', async () => {
      redisService.get.mockResolvedValueOnce(null);
      redisService.get.mockResolvedValueOnce('1');
      redisService.get.mockResolvedValueOnce('2');
      redisService.get.mockResolvedValueOnce('3');
      redisService.get.mockResolvedValueOnce('4');

      let result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      await service.incrementAttempts(userId);

      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      await service.incrementAttempts(userId);

      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      await service.incrementAttempts(userId);

      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      await service.incrementAttempts(userId);

      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      await service.incrementAttempts(userId);

      redisService.get.mockResolvedValueOnce('5');
      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(false);
    });

    it('should reset and allow requests after reset', async () => {
      redisService.get.mockResolvedValueOnce('5');
      redisService.get.mockResolvedValueOnce(null);

      let result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(false);

      await service.resetAttempts(userId);

      result = await service.checkRateLimit(userId);
      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(5);
    });
  });
});
