import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../common/services/redis.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';

describe('TokenBlacklistService', () => {
  let tokenBlacklistService: TokenBlacklistService;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    tokenBlacklistService = module.get<TokenBlacklistService>(TokenBlacklistService);
  });

  it('should be defined', () => {
    expect(tokenBlacklistService).toBeDefined();
  });

  describe('blacklistToken', () => {
    it('should add a token to the blacklist with proper TTL', async () => {
      // Mock the Redis set method to return success
      mockRedisService.set.mockResolvedValue(true);

      // Call the method
      const result = await tokenBlacklistService.blacklistToken('test-token-id');

      // Verify Redis was called with correct parameters
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('test-token-id'),
        'blacklisted',
        expect.any(Number),
      );

      // Verify the result
      expect(result).toBe(true);
    });
  });

  describe('isBlacklisted', () => {
    it('should return true if token is blacklisted', async () => {
      // Mock Redis get to return a value (token is blacklisted)
      mockRedisService.get.mockResolvedValue('blacklisted');

      const result = await tokenBlacklistService.isBlacklisted('test-token-id');

      expect(mockRedisService.get).toHaveBeenCalledWith(expect.stringContaining('test-token-id'));
      expect(result).toBe(true);
    });

    it('should return false if token is not blacklisted', async () => {
      // Mock Redis get to return null (token not blacklisted)
      mockRedisService.get.mockResolvedValue(null);

      const result = await tokenBlacklistService.isBlacklisted('test-token-id');

      expect(mockRedisService.get).toHaveBeenCalledWith(expect.stringContaining('test-token-id'));
      expect(result).toBe(false);
    });
  });

  describe('parseJwtExpirationToSeconds', () => {
    it('should correctly parse seconds', async () => {
      const result = (tokenBlacklistService as any).parseJwtExpirationToSeconds('30s');
      expect(result).toBe(30);
    });

    it('should correctly parse minutes', async () => {
      const result = (tokenBlacklistService as any).parseJwtExpirationToSeconds('15m');
      expect(result).toBe(15 * 60);
    });

    it('should correctly parse hours', async () => {
      const result = (tokenBlacklistService as any).parseJwtExpirationToSeconds('2h');
      expect(result).toBe(2 * 60 * 60);
    });

    it('should correctly parse days', async () => {
      const result = (tokenBlacklistService as any).parseJwtExpirationToSeconds('7d');
      expect(result).toBe(7 * 24 * 60 * 60);
    });

    it('should return default value for invalid format', async () => {
      const result = (tokenBlacklistService as any).parseJwtExpirationToSeconds('invalid');
      expect(result).toBe(3600); // 1 hour default
    });
  });
});
