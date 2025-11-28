import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config';
import { DistributedLockService } from './distributed-lock.service';
import { LockMetricsService } from './lock-metrics.service';
import { RedisService } from './redis.service';

describe('DistributedLockService - Metrics Integration', () => {
  let distributedLockService: DistributedLockService;
  let metricsService: LockMetricsService;
  let redisClient: Redis;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [redisConfig],
        }),
      ],
      providers: [RedisService, LockMetricsService, DistributedLockService],
    }).compile();

    distributedLockService = module.get<DistributedLockService>(DistributedLockService);
    metricsService = module.get<LockMetricsService>(LockMetricsService);

    await distributedLockService.onModuleInit();

    // Create a dedicated Redis client for cleanup
    const config = redisConfig().redis;
    redisClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
    });
  });

  afterAll(async () => {
    await distributedLockService.onModuleDestroy();
    await metricsService.onModuleDestroy();
    await redisClient.quit();
  });

  afterEach(async () => {
    // Clean up any remaining locks
    const keys = await redisClient.keys('locks:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  describe('Lock acquisition metrics', () => {
    it('should record successful lock acquisition metrics', async () => {
      const resource = 'test:metrics:success';
      const lock = await distributedLockService.acquireLock(resource, 5000);

      const stats = metricsService.getLockStats(resource);
      expect(stats.totalAcquisitions).toBe(1);
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(0);
      expect(stats.averageAcquisitionTime).toBeGreaterThanOrEqual(0);

      await distributedLockService.releaseLock(lock);
    });

    it('should record failed lock acquisition metrics', async () => {
      const resource = 'test:metrics:failure';

      // Acquire lock first
      const lock1 = await distributedLockService.acquireLock(resource, 5000);

      // Try to acquire the same lock (should fail)
      try {
        await distributedLockService.acquireLock(resource, 5000, { retryCount: 0 });
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
      }

      const stats = metricsService.getLockStats(resource);
      expect(stats.totalAcquisitions).toBe(2);
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(1);

      await distributedLockService.releaseLock(lock1);
    });

    it('should record acquisition time metrics', async () => {
      const resource = 'test:metrics:timing';
      const lock = await distributedLockService.acquireLock(resource, 5000);

      const stats = metricsService.getLockStats(resource);
      expect(stats.averageAcquisitionTime).toBeGreaterThanOrEqual(0);
      expect(stats.averageAcquisitionTime).toBeLessThan(1000); // Should be fast

      await distributedLockService.releaseLock(lock);
    });
  });

  describe('Lock hold time metrics', () => {
    it('should record lock hold time on release', async () => {
      const resource = 'test:metrics:holdtime';
      const lock = await distributedLockService.acquireLock(resource, 5000);

      // Wait a bit before releasing
      await new Promise((resolve) => setTimeout(resolve, 100));

      await distributedLockService.releaseLock(lock);

      const stats = metricsService.getLockStats(resource);
      expect(stats.averageHoldTime).toBeGreaterThanOrEqual(100);
      expect(stats.averageHoldTime).toBeLessThan(500); // Should be around 100ms
    });

    it('should calculate average hold time across multiple acquisitions', async () => {
      const resource = 'test:metrics:avghold';

      // First acquisition - hold for ~50ms
      let lock = await distributedLockService.acquireLock(resource, 5000);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await distributedLockService.releaseLock(lock);

      // Second acquisition - hold for ~150ms
      lock = await distributedLockService.acquireLock(resource, 5000);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await distributedLockService.releaseLock(lock);

      const stats = metricsService.getLockStats(resource);
      expect(stats.averageHoldTime).toBeGreaterThanOrEqual(90); // ~100ms average
      expect(stats.averageHoldTime).toBeLessThan(150);
    });
  });

  describe('Lock extension metrics', () => {
    it('should record lock extensions', async () => {
      const resource = 'test:metrics:extension';
      const lock = await distributedLockService.acquireLock(resource, 5000);

      await distributedLockService.extendLock(lock, 5000);
      await distributedLockService.extendLock(lock, 5000);

      const stats = metricsService.getLockStats();
      expect(stats.totalExtensions).toBeGreaterThanOrEqual(2);

      await distributedLockService.releaseLock(lock);
    });

    it('should track extensions per resource', async () => {
      const resource1 = 'test:metrics:ext1';
      const resource2 = 'test:metrics:ext2';

      const lock1 = await distributedLockService.acquireLock(resource1, 5000);
      const lock2 = await distributedLockService.acquireLock(resource2, 5000);

      await distributedLockService.extendLock(lock1, 5000);
      await distributedLockService.extendLock(lock1, 5000);
      await distributedLockService.extendLock(lock2, 5000);

      const topContended = metricsService.getTopContendedResources();
      const res1Stats = topContended.find((r) => r.resource === resource1);
      const res2Stats = topContended.find((r) => r.resource === resource2);

      expect(res1Stats?.extensions).toBe(2);
      expect(res2Stats?.extensions).toBe(1);

      await distributedLockService.releaseLock(lock1);
      await distributedLockService.releaseLock(lock2);
    });
  });

  describe('withLock metrics', () => {
    it('should record metrics for withLock operations', async () => {
      const resource = 'test:metrics:withlock';

      const result = await distributedLockService.withLock(resource, 5000, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'success';
      });

      expect(result).toBe('success');

      const stats = metricsService.getLockStats(resource);
      expect(stats.totalAcquisitions).toBe(1);
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.averageHoldTime).toBeGreaterThanOrEqual(50);
    });

    it('should record metrics even when operation fails', async () => {
      const resource = 'test:metrics:withlock:error';

      try {
        await distributedLockService.withLock(resource, 5000, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          throw new Error('Operation failed');
        });
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
      }

      const stats = metricsService.getLockStats(resource);
      expect(stats.totalAcquisitions).toBe(1);
      expect(stats.successfulAcquisitions).toBe(1); // Acquisition was successful
      expect(stats.averageHoldTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Contention metrics', () => {
    it('should identify highly contended resources', async () => {
      // Create high contention on resource1
      const resource1 = 'test:metrics:contention:high';
      const resource2 = 'test:metrics:contention:low';

      // Resource 1: High contention (50% failure rate)
      const lock1 = await distributedLockService.acquireLock(resource1, 5000);
      try {
        await distributedLockService.acquireLock(resource1, 5000, { retryCount: 0 });
      } catch {
        // Expected
      }
      await distributedLockService.releaseLock(lock1);

      // Resource 2: Low contention (100% success)
      const lock2 = await distributedLockService.acquireLock(resource2, 5000);
      await distributedLockService.releaseLock(lock2);

      const topContended = metricsService.getTopContendedResources();
      expect(topContended.length).toBeGreaterThan(0);

      const res1Stats = topContended.find((r) => r.resource === resource1);
      const res2Stats = topContended.find((r) => r.resource === resource2);

      expect(res1Stats?.contentionRate).toBeGreaterThan(res2Stats?.contentionRate || 0);
    });
  });

  describe('Global statistics', () => {
    it('should provide accurate global statistics', async () => {
      const resources = ['test:global:1', 'test:global:2', 'test:global:3'];

      for (const resource of resources) {
        const lock = await distributedLockService.acquireLock(resource, 5000);
        await new Promise((resolve) => setTimeout(resolve, 50));
        await distributedLockService.releaseLock(lock);
      }

      const globalStats = metricsService.getLockStats();
      expect(globalStats.totalAcquisitions).toBeGreaterThanOrEqual(3);
      expect(globalStats.successfulAcquisitions).toBeGreaterThanOrEqual(3);
      expect(globalStats.resourceStats?.size).toBeGreaterThanOrEqual(3);
    });

    it('should include per-resource breakdown in global stats', async () => {
      const resource = 'test:global:breakdown';
      const lock = await distributedLockService.acquireLock(resource, 5000);
      await distributedLockService.releaseLock(lock);

      const globalStats = metricsService.getLockStats();
      expect(globalStats.resourceStats).toBeDefined();

      const resourceStats = globalStats.resourceStats?.get(resource);
      expect(resourceStats).toBeDefined();
      expect(resourceStats?.acquisitions).toBeGreaterThanOrEqual(1);
    });
  });
});
