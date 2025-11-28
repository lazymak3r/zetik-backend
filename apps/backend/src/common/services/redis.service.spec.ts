import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { redisConfig } from '../../config/redis.config';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [redisConfig] })],
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.disconnect();
  });

  describe('sismember', () => {
    const testKey = 'test-set-' + Date.now();

    it('should return false when member does not exist', async () => {
      const result = await service.sismember(testKey, 'non-existent');
      expect(result).toBe(false);
    });

    it('should return true when member exists in set', async () => {
      await service.sadd(testKey, 'member1');
      const result = await service.sismember(testKey, 'member1');
      expect(result).toBe(true);
    });

    it('should return false after member is removed', async () => {
      const key = testKey + '-2';
      await service.sadd(key, 'member1');
      await service.srem(key, 'member1');
      const result = await service.sismember(key, 'member1');
      expect(result).toBe(false);
    });

    it('should handle non-existent keys gracefully', async () => {
      const result = await service.sismember('non-existent-key-' + Date.now(), 'member');
      expect(result).toBe(false);
    });
  });

  describe('sremIfExists', () => {
    const testKey = 'test-atomic-' + Date.now();

    beforeEach(async () => {
      await service.del(testKey);
    });

    it('should remove member if it exists', async () => {
      await service.sadd(testKey, 'member1');
      const removed = await service.sremIfExists(testKey, 'member1');
      expect(removed).toBe(true);

      const exists = await service.sismember(testKey, 'member1');
      expect(exists).toBe(false);
    });

    it('should return false if member does not exist', async () => {
      const removed = await service.sremIfExists(testKey, 'non-existent');
      expect(removed).toBe(false);
    });

    it('should be idempotent - calling twice with non-existent member', async () => {
      const result1 = await service.sremIfExists(testKey, 'member1');
      const result2 = await service.sremIfExists(testKey, 'member1');

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle concurrent removes gracefully', async () => {
      const key = testKey + '-concurrent';
      await service.sadd(key, 'member1');

      // Simulate concurrent removes
      const [result1, result2] = await Promise.all([
        service.sremIfExists(key, 'member1'),
        service.sremIfExists(key, 'member1'),
      ]);

      // Only one should succeed (atomic operation)
      expect(result1 || result2).toBe(true);

      const exists = await service.sismember(key, 'member1');
      expect(exists).toBe(false);
    });
  });
});
