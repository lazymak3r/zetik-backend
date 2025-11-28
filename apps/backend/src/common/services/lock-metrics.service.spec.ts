import { Test, TestingModule } from '@nestjs/testing';
import { LockMetricsService } from './lock-metrics.service';

describe('LockMetricsService', () => {
  let service: LockMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LockMetricsService],
    }).compile();

    service = module.get<LockMetricsService>(LockMetricsService);
  });

  afterEach(() => {
    // Clean up any intervals
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordLockAcquisition', () => {
    it('should record successful lock acquisition', () => {
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 100,
        success: true,
      });

      const stats = service.getLockStats('test:resource');
      expect(stats.totalAcquisitions).toBe(1);
      expect(stats.successfulAcquisitions).toBe(1);
      expect(stats.failedAcquisitions).toBe(0);
      expect(stats.averageAcquisitionTime).toBe(100);
    });

    it('should record failed lock acquisition', () => {
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 50,
        success: false,
      });

      const stats = service.getLockStats('test:resource');
      expect(stats.totalAcquisitions).toBe(1);
      expect(stats.successfulAcquisitions).toBe(0);
      expect(stats.failedAcquisitions).toBe(1);
      expect(stats.averageAcquisitionTime).toBe(50);
    });

    it('should record multiple acquisitions and calculate averages', () => {
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 100,
        success: true,
      });

      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 200,
        success: true,
      });

      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 300,
        success: false,
      });

      const stats = service.getLockStats('test:resource');
      expect(stats.totalAcquisitions).toBe(3);
      expect(stats.successfulAcquisitions).toBe(2);
      expect(stats.failedAcquisitions).toBe(1);
      expect(stats.averageAcquisitionTime).toBe(200); // (100 + 200 + 300) / 3
    });
  });

  describe('recordLockRelease', () => {
    it('should record lock hold time', () => {
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 100,
        success: true,
      });

      service.recordLockRelease('test:resource', 5000);

      const stats = service.getLockStats('test:resource');
      expect(stats.averageHoldTime).toBe(5000);
    });

    it('should calculate average hold time for multiple releases', () => {
      // First acquisition and release
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockRelease('test:resource', 3000);

      // Second acquisition and release
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 150,
        success: true,
      });
      service.recordLockRelease('test:resource', 5000);

      const stats = service.getLockStats('test:resource');
      expect(stats.averageHoldTime).toBe(4000); // (3000 + 5000) / 2
    });
  });

  describe('recordLockExtension', () => {
    it('should record lock extensions', () => {
      service.recordLockExtension('test:resource');
      service.recordLockExtension('test:resource');
      service.recordLockExtension('test:resource');

      const stats = service.getLockStats();
      expect(stats.totalExtensions).toBe(3);
    });

    it('should track extensions per resource', () => {
      // Need to record acquisitions first for resources to appear in stats
      service.recordLockAcquisition({
        resource: 'resource:1',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 100,
        success: true,
      });

      // Now record extensions
      service.recordLockExtension('resource:1');
      service.recordLockExtension('resource:1');
      service.recordLockExtension('resource:2');

      const topContended = service.getTopContendedResources();
      const resource1Stats = topContended.find((r) => r.resource === 'resource:1');
      const resource2Stats = topContended.find((r) => r.resource === 'resource:2');

      expect(resource1Stats?.extensions).toBe(2);
      expect(resource2Stats?.extensions).toBe(1);
    });
  });

  describe('recordLockFailure', () => {
    it('should record lock failure with reason', () => {
      service.recordLockFailure('test:resource', 'Lock timeout');

      const stats = service.getLockStats('test:resource');
      expect(stats.failedAcquisitions).toBe(1);
    });
  });

  describe('getLockStats', () => {
    it('should return empty stats when no metrics recorded', () => {
      const stats = service.getLockStats('nonexistent:resource');

      expect(stats.totalAcquisitions).toBe(0);
      expect(stats.successfulAcquisitions).toBe(0);
      expect(stats.failedAcquisitions).toBe(0);
      expect(stats.averageAcquisitionTime).toBe(0);
      expect(stats.averageHoldTime).toBe(0);
      expect(stats.totalExtensions).toBe(0);
    });

    it('should return global stats without resource parameter', () => {
      service.recordLockAcquisition({
        resource: 'resource:1',
        acquisitionTimeMs: 100,
        success: true,
      });

      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 200,
        success: true,
      });

      const stats = service.getLockStats();
      expect(stats.totalAcquisitions).toBe(2);
      expect(stats.averageAcquisitionTime).toBe(150); // (100 + 200) / 2
    });

    it('should include per-resource breakdown in global stats', () => {
      service.recordLockAcquisition({
        resource: 'resource:1',
        acquisitionTimeMs: 100,
        success: true,
      });

      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 200,
        success: true,
      });

      const stats = service.getLockStats();
      expect(stats.resourceStats).toBeDefined();
      expect(stats.resourceStats?.size).toBe(2);
      expect(stats.resourceStats?.get('resource:1')).toBeDefined();
      expect(stats.resourceStats?.get('resource:2')).toBeDefined();
    });
  });

  describe('getTopContendedResources', () => {
    it('should return empty array when no metrics recorded', () => {
      const topContended = service.getTopContendedResources();
      expect(topContended).toEqual([]);
    });

    it('should return resources sorted by contention rate', () => {
      // Resource 1: 50% contention (2 total, 1 failed)
      service.recordLockAcquisition({
        resource: 'resource:1',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockAcquisition({
        resource: 'resource:1',
        acquisitionTimeMs: 150,
        success: false,
      });

      // Resource 2: 33% contention (3 total, 1 failed)
      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockAcquisition({
        resource: 'resource:2',
        acquisitionTimeMs: 100,
        success: false,
      });

      // Resource 3: 0% contention (1 total, 0 failed)
      service.recordLockAcquisition({
        resource: 'resource:3',
        acquisitionTimeMs: 100,
        success: true,
      });

      const topContended = service.getTopContendedResources();

      expect(topContended[0].resource).toBe('resource:1');
      expect(topContended[0].contentionRate).toBe(0.5);
      expect(topContended[1].resource).toBe('resource:2');
      expect(topContended[1].contentionRate).toBeCloseTo(0.333, 2);
      expect(topContended[2].resource).toBe('resource:3');
      expect(topContended[2].contentionRate).toBe(0);
    });

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        service.recordLockAcquisition({
          resource: `resource:${i}`,
          acquisitionTimeMs: 100,
          success: true,
        });
      }

      const topContended = service.getTopContendedResources(3);
      expect(topContended.length).toBe(3);
    });

    it('should include all statistics in resource stats', () => {
      service.recordLockAcquisition({
        resource: 'test:resource',
        acquisitionTimeMs: 100,
        success: true,
      });
      service.recordLockRelease('test:resource', 5000);
      service.recordLockExtension('test:resource');

      const topContended = service.getTopContendedResources();
      const resourceStats = topContended[0];

      expect(resourceStats.resource).toBe('test:resource');
      expect(resourceStats.acquisitions).toBe(1);
      expect(resourceStats.successful).toBe(1);
      expect(resourceStats.failed).toBe(0);
      expect(resourceStats.avgAcquisitionTime).toBe(100);
      expect(resourceStats.avgHoldTime).toBe(5000);
      expect(resourceStats.extensions).toBe(1);
      expect(resourceStats.contentionRate).toBe(0);
    });
  });

  describe('metrics buffer management', () => {
    it('should maintain circular buffer size limit', () => {
      // Add more than max size (10000)
      for (let i = 0; i < 15000; i++) {
        service.recordLockAcquisition({
          resource: `resource:${i % 100}`,
          acquisitionTimeMs: 100,
          success: true,
        });
      }

      const stats = service.getLockStats();
      // Should only have the last 10000 entries
      expect(stats.totalAcquisitions).toBeLessThanOrEqual(10000);
    });
  });

  describe('periodic logging', () => {
    it('should initialize periodic logging on module init', () => {
      service.onModuleInit();
      // Just verify it doesn't throw
      expect(service).toBeDefined();
    });

    it('should clean up periodic logging on module destroy', () => {
      service.onModuleInit();
      service.onModuleDestroy();
      // Just verify it doesn't throw
      expect(service).toBeDefined();
    });
  });
});
