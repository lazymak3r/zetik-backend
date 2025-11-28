import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../common/services/redis.service';
import { computeTokenHash } from '../common/utils/token-hash.util';
import { redisConfig } from '../config/redis.config';

describe('Session isActive Field - Redis Integration', () => {
  let redisService: RedisService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [redisConfig] })],
      providers: [RedisService],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    await redisService.onModuleInit();
  });

  afterAll(async () => {
    await redisService.disconnect();
  });

  describe('isActive determination logic', () => {
    beforeEach(async () => {
      await redisService.del('active_sessions');
    });

    it('should mark session as inactive when tokenHash not in active_sessions set', async () => {
      const tokenHash = computeTokenHash('test-token-' + Date.now());

      const isActive = await redisService.sismember('active_sessions', tokenHash);

      expect(isActive).toBe(false);
    });

    it('should mark session as active when tokenHash is in active_sessions set', async () => {
      const tokenHash = computeTokenHash('test-token-active-' + Date.now());

      // Add to Redis active_sessions (simulates WebSocket connection)
      await redisService.sadd('active_sessions', tokenHash);

      const isActive = await redisService.sismember('active_sessions', tokenHash);

      expect(isActive).toBe(true);
    });

    it('should correctly track multiple sessions with different activity states', async () => {
      const token1 = 'token-1-' + Date.now();
      const token2 = 'token-2-' + Date.now();
      const token3 = 'token-3-' + Date.now();

      const hash1 = computeTokenHash(token1);
      const hash2 = computeTokenHash(token2);
      const hash3 = computeTokenHash(token3);

      // Add only some sessions to active_sessions
      await redisService.sadd('active_sessions', hash1, hash3);

      const isActive1 = await redisService.sismember('active_sessions', hash1);
      const isActive2 = await redisService.sismember('active_sessions', hash2);
      const isActive3 = await redisService.sismember('active_sessions', hash3);

      expect(isActive1).toBe(true); // Connected to WebSocket
      expect(isActive2).toBe(false); // Not connected to WebSocket
      expect(isActive3).toBe(true); // Connected to WebSocket
    });

    it('should transition session from inactive to active when WebSocket connects', async () => {
      const tokenHash = computeTokenHash('test-token-connect-' + Date.now());

      // Initial state: inactive (not in Redis)
      let isActive = await redisService.sismember('active_sessions', tokenHash);
      expect(isActive).toBe(false);

      // WebSocket connection: add to active_sessions
      await redisService.sadd('active_sessions', tokenHash);

      // New state: active
      isActive = await redisService.sismember('active_sessions', tokenHash);
      expect(isActive).toBe(true);
    });

    it('should transition session from active to inactive when WebSocket disconnects', async () => {
      const tokenHash = computeTokenHash('test-token-disconnect-' + Date.now());

      // Initial state: active (in Redis)
      await redisService.sadd('active_sessions', tokenHash);
      let isActive = await redisService.sismember('active_sessions', tokenHash);
      expect(isActive).toBe(true);

      // WebSocket disconnect: remove from active_sessions
      await redisService.sremIfExists('active_sessions', tokenHash);

      // New state: inactive
      isActive = await redisService.sismember('active_sessions', tokenHash);
      expect(isActive).toBe(false);
    });

    it('should handle many concurrent session checks', async () => {
      const hashes = Array.from({ length: 10 }, (_, i) =>
        computeTokenHash(`token-${i}-${Date.now()}`),
      );

      // Add every other session
      for (let i = 0; i < hashes.length; i += 2) {
        await redisService.sadd('active_sessions', hashes[i]);
      }

      // Check all concurrently
      const results = await Promise.all(
        hashes.map((hash) => redisService.sismember('active_sessions', hash)),
      );

      // Verify correct pattern
      for (let i = 0; i < results.length; i++) {
        if (i % 2 === 0) {
          expect(results[i]).toBe(true); // Should be active
        } else {
          expect(results[i]).toBe(false); // Should be inactive
        }
      }
    });
  });
});
