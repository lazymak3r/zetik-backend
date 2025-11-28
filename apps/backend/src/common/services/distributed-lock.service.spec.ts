import { Test, TestingModule } from '@nestjs/testing';
import { Lock } from 'redlock';
import { DistributedLockService } from './distributed-lock.service';
import { LockMetricsService } from './lock-metrics.service';
import { RedisService } from './redis.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;
  let redisService: jest.Mocked<RedisService>;

  // Mock Redis client
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    ping: jest.fn(),
  };

  // Mock Redlock instance
  const mockRedlock = {
    acquire: jest.fn(),
    on: jest.fn(),
  };

  // Mock Lock instance
  const createMockLock = (resources: string[]): jest.Mocked<Lock> =>
    ({
      resources,
      expiration: Date.now() + 10000,
      attempts: [],
      release: jest.fn().mockResolvedValue(undefined),
      extend: jest.fn(),
    }) as any;

  beforeEach(async () => {
    // Create mock RedisService
    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setNX: jest.fn(),
      ping: jest.fn(),
      disconnect: jest.fn(),
    };

    // Create mock LockMetricsService
    const mockLockMetricsService = {
      recordLockAcquisition: jest.fn(),
      recordLockRelease: jest.fn(),
      recordLockExtension: jest.fn(),
      recordLockFailure: jest.fn(),
      getMetrics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributedLockService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: LockMetricsService,
          useValue: mockLockMetricsService,
        },
      ],
    }).compile();

    service = module.get<DistributedLockService>(DistributedLockService);
    redisService = module.get(RedisService);

    // Replace the redisClient and redlock instances with mocks
    (service as any).redisClient = mockRedisClient;
    (service as any).redlock = mockRedlock;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis client and Redlock on module init', async () => {
      // This is tested through the service initialization in beforeEach
      expect(service).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close Redis connection on module destroy', async () => {
      // Arrange
      mockRedisClient.quit.mockResolvedValue('OK');

      // Act
      await service.onModuleDestroy();

      // Assert
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle errors when closing Redis connection', async () => {
      // Arrange
      const error = new Error('Connection error');
      mockRedisClient.quit.mockRejectedValue(error);

      // Act & Assert - should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('acquireLock', () => {
    it('should successfully acquire a lock', async () => {
      // Arrange
      const resource = 'test-resource';
      const ttl = 5000;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Act
      const lock = await service.acquireLock(resource, ttl);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        ttl,
        expect.any(Object),
      );
      expect(lock).toBe(mockLock);
      expect(lock.resources).toContain(`locks:${resource}`);
    });

    it('should use default TTL if not provided', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Act
      await service.acquireLock(resource);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        10000, // DEFAULT_TTL
        expect.any(Object),
      );
    });

    it('should apply custom retry options', async () => {
      // Arrange
      const resource = 'test-resource';
      const ttl = 5000;
      const options = {
        retryCount: 5,
        retryDelay: 300,
        retryJitter: 150,
      };
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Act
      await service.acquireLock(resource, ttl, options);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        ttl,
        expect.objectContaining({
          retryCount: 5,
          retryDelay: 300,
          retryJitter: 150,
        }),
      );
    });

    it('should throw error if lock cannot be acquired', async () => {
      // Arrange
      const resource = 'test-resource';
      const error = new Error('Resource already locked');
      mockRedlock.acquire.mockRejectedValue(error);

      // Act & Assert
      await expect(service.acquireLock(resource)).rejects.toThrow(
        'System is busy processing your request. Please try again in a few seconds.',
      );
    });
  });

  describe('releaseLock', () => {
    it('should successfully release a lock', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:test-resource']);

      // Act
      await service.releaseLock(mockLock);

      // Assert
      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should handle errors when releasing lock', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:test-resource']);
      const error = new Error('Lock already released');
      mockLock.release.mockRejectedValue(error);

      // Act & Assert - should not throw
      await expect(service.releaseLock(mockLock)).resolves.not.toThrow();
    });
  });

  describe('extendLock', () => {
    it('should successfully extend a lock', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:test-resource']);
      const extendedLock = createMockLock(['locks:test-resource']);
      mockLock.extend.mockResolvedValue(extendedLock);
      const newTTL = 5000;

      // Act
      const result = await service.extendLock(mockLock, newTTL);

      // Assert
      expect(mockLock.extend).toHaveBeenCalledWith(newTTL);
      expect(result).toBe(extendedLock);
    });

    it('should throw error if lock cannot be extended', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:test-resource']);
      const error = new Error('Lock expired');
      mockLock.extend.mockRejectedValue(error);

      // Act & Assert
      await expect(service.extendLock(mockLock, 5000)).rejects.toThrow(
        'Unable to extend lock for resources: locks:test-resource',
      );
    });
  });

  describe('withLock', () => {
    it('should execute operation with automatic lock management', async () => {
      // Arrange
      const resource = 'test-resource';
      const ttl = 5000;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      const operation = jest.fn().mockResolvedValue('operation result');

      // Act
      const result = await service.withLock(resource, ttl, operation);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        ttl,
        expect.any(Object),
      );
      expect(operation).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();
      expect(result).toBe('operation result');
    });

    it('should release lock even if operation fails', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.withLock(resource, 5000, operation)).rejects.toThrow('Operation failed');
      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should execute operation successfully with options', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      const operation = jest.fn().mockResolvedValue('result');

      // Act
      const result = await service.withLock(resource, 5000, operation);

      // Assert
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    it('should use default TTL if not provided', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      const operation = jest.fn().mockResolvedValue('result');

      // Act
      await service.withLock(resource, undefined, operation);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        10000, // DEFAULT_TTL
        expect.any(Object),
      );
    });

    it('should pass retry options to acquireLock', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      const operation = jest.fn().mockResolvedValue('result');
      const options = {
        retryCount: 5,
        retryDelay: 300,
      };

      // Act
      await service.withLock(resource, 5000, operation, options);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        5000,
        expect.objectContaining({
          retryCount: 5,
          retryDelay: 300,
        }),
      );
    });

    it('should automatically extend lock for long-running operations', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000; // 10 seconds
      const mockLock = createMockLock([`locks:${resource}`]);
      const extendedLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      mockLock.extend.mockResolvedValue(extendedLock);

      const operation = jest.fn().mockImplementation(async () => {
        // Simulate long operation (advance time to trigger extension)
        jest.advanceTimersByTime(ttl * 0.6 + 100); // Past 60% of TTL
        await Promise.resolve(); // Allow extension interval to fire
        return 'result';
      });

      // Act
      const resultPromise = service.withLock(resource, ttl, operation);

      // Advance timers to trigger extension
      await jest.advanceTimersByTimeAsync(ttl * 0.6 + 100);

      const result = await resultPromise;

      // Assert
      expect(result).toBe('result');
      expect(mockLock.extend).toHaveBeenCalledWith(ttl);
      expect(mockLock.release).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should clear extension interval when operation completes early', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      const operation = jest.fn().mockResolvedValue('quick result');

      // Act
      const result = await service.withLock(resource, ttl, operation);

      // Assert
      expect(result).toBe('quick result');
      expect(mockLock.extend).not.toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should handle lock extension failures gracefully', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      mockLock.extend.mockRejectedValue(new Error('Extension failed'));

      const operation = jest.fn().mockImplementation(async () => {
        jest.advanceTimersByTime(ttl * 0.6 + 100);
        await Promise.resolve();
        return 'result despite extension failure';
      });

      // Act
      const resultPromise = service.withLock(resource, ttl, operation);
      await jest.advanceTimersByTimeAsync(ttl * 0.6 + 100);
      const result = await resultPromise;

      // Assert - operation should complete even if extension fails
      expect(result).toBe('result despite extension failure');
      expect(mockLock.extend).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should clear extension interval when operation fails', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(service.withLock(resource, ttl, operation)).rejects.toThrow('Operation failed');
      expect(mockLock.release).toHaveBeenCalled();

      // Verify extension interval was cleared (no extension calls after operation fails)
      jest.advanceTimersByTime(ttl * 0.6 + 100);
      await jest.runOnlyPendingTimersAsync();
      expect(mockLock.extend).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should stop auto-extension after MAX_EXTENSION_FAILURES consecutive failures', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000;
      const extensionIntervalMs = ttl * 0.6;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      mockLock.extend.mockRejectedValue(new Error('Extension failed'));

      // Create a long-running operation that lasts longer than 3 extension intervals
      const operation = jest.fn().mockImplementation(async () => {
        // Advance through 4 extension intervals to trigger MAX_EXTENSION_FAILURES
        for (let i = 0; i < 4; i++) {
          jest.advanceTimersByTime(extensionIntervalMs + 100);
          await jest.runOnlyPendingTimersAsync();
        }
        return 'completed';
      });

      // Act
      const resultPromise = service.withLock(resource, ttl, operation);
      const result = await resultPromise;

      // Assert
      expect(result).toBe('completed');
      // Should have attempted extension 3 times before stopping
      expect(mockLock.extend).toHaveBeenCalledTimes(3);
      expect(mockLock.release).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should reset failure counter on successful extension', async () => {
      // Arrange
      jest.useFakeTimers();
      const resource = 'test-resource';
      const ttl = 10000;
      const extensionIntervalMs = ttl * 0.6;
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Fail twice, then succeed, then fail twice more - should continue extending
      let callCount = 0;
      mockLock.extend.mockImplementation(() => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          return Promise.reject(new Error('Extension failed'));
        } else if (callCount === 3) {
          return Promise.resolve(mockLock);
        } else {
          return Promise.reject(new Error('Extension failed'));
        }
      });

      const operation = jest.fn().mockImplementation(async () => {
        // Advance through 5 extension intervals
        for (let i = 0; i < 5; i++) {
          jest.advanceTimersByTime(extensionIntervalMs + 100);
          await jest.runOnlyPendingTimersAsync();
        }
        return 'completed';
      });

      // Act
      const resultPromise = service.withLock(resource, ttl, operation);
      const result = await resultPromise;

      // Assert
      expect(result).toBe('completed');
      // Should have attempted extension 5 times (reset after success on 3rd attempt)
      expect(mockLock.extend).toHaveBeenCalledTimes(5);
      expect(mockLock.release).toHaveBeenCalled();

      jest.useRealTimers();
    });
  });

  describe('tryLock', () => {
    it('should acquire lock immediately if available', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Act
      const lock = await service.tryLock(resource, 5000);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        5000,
        expect.objectContaining({ retryCount: 0 }),
      );
      expect(lock).toBe(mockLock);
    });

    it('should return null if lock is not available', async () => {
      // Arrange
      const resource = 'test-resource';
      const error = new Error('Resource already locked');
      mockRedlock.acquire.mockRejectedValue(error);

      // Act
      const lock = await service.tryLock(resource, 5000);

      // Assert
      expect(lock).toBeNull();
    });

    it('should use default TTL if not provided', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Act
      await service.tryLock(resource);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalledWith(
        [`locks:${resource}`],
        10000, // DEFAULT_TTL
        expect.objectContaining({ retryCount: 0 }),
      );
    });
  });

  describe('isLocked', () => {
    it('should return true if resource is locked', async () => {
      // Arrange
      const resource = 'test-resource';
      redisService.exists.mockResolvedValue(true);

      // Act
      const result = await service.isLocked(resource);

      // Assert
      expect(redisService.exists).toHaveBeenCalledWith(`locks:${resource}`);
      expect(result).toBe(true);
    });

    it('should return false if resource is not locked', async () => {
      // Arrange
      const resource = 'test-resource';
      redisService.exists.mockResolvedValue(false);

      // Act
      const result = await service.isLocked(resource);

      // Assert
      expect(redisService.exists).toHaveBeenCalledWith(`locks:${resource}`);
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      // Arrange
      const resource = 'test-resource';
      const error = new Error('Redis error');
      redisService.exists.mockRejectedValue(error);

      // Act
      const result = await service.isLocked(resource);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('concurrent lock acquisition', () => {
    it('should handle multiple concurrent lock attempts', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock1 = createMockLock([`locks:${resource}`]);

      let firstCall = true;
      mockRedlock.acquire.mockImplementation(() => {
        if (firstCall) {
          firstCall = false;
          return Promise.resolve(mockLock1);
        } else {
          return Promise.reject(new Error('Resource already locked'));
        }
      });

      // Act
      const [lock1, lock2Error] = await Promise.allSettled([
        service.acquireLock(resource, 5000),
        service.acquireLock(resource, 5000),
      ]);

      // Assert
      expect(lock1.status).toBe('fulfilled');
      expect(lock2Error.status).toBe('rejected');
      if (lock1.status === 'fulfilled') {
        expect(lock1.value).toBe(mockLock1);
      }
    });

    it('should allow second lock after first is released', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock1 = createMockLock([`locks:${resource}`]);
      const mockLock2 = createMockLock([`locks:${resource}`]);

      mockRedlock.acquire.mockResolvedValueOnce(mockLock1).mockResolvedValueOnce(mockLock2);

      // Act
      const lock1 = await service.acquireLock(resource, 5000);
      await service.releaseLock(lock1);
      const lock2 = await service.acquireLock(resource, 5000);

      // Assert
      expect(lock1).toBe(mockLock1);
      expect(lock2).toBe(mockLock2);
      expect(mockLock1.release).toHaveBeenCalled();
    });
  });

  describe('lock expiration', () => {
    it('should handle lock expiration gracefully', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      // Simulate lock expiration during operation
      const operation = jest.fn().mockImplementation(async () => {
        // Simulate lock expiring
        const error = new Error('Lock expired');
        mockLock.release.mockRejectedValue(error);
        return 'result';
      });

      // Act
      const result = await service.withLock(resource, 100, operation);

      // Assert
      expect(result).toBe('result');
      expect(mockLock.release).toHaveBeenCalled();
    });
  });

  describe('error scenarios', () => {
    it('should handle Redis connection errors', async () => {
      // Arrange
      const resource = 'test-resource';
      const error = new Error('Redis connection lost');
      mockRedlock.acquire.mockRejectedValue(error);

      // Act & Assert
      await expect(service.acquireLock(resource)).rejects.toThrow(
        'System is busy processing your request. Please try again in a few seconds.',
      );
    });

    it('should handle lock extension failures', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:test-resource']);
      const error = new Error('Network error');
      mockLock.extend.mockRejectedValue(error);

      // Act & Assert
      await expect(service.extendLock(mockLock, 5000)).rejects.toThrow(
        'Unable to extend lock for resources: locks:test-resource',
      );
    });

    it('should handle multiple resource locks', async () => {
      // Arrange
      const mockLock = createMockLock(['locks:resource-1', 'locks:resource-2']);
      const error = new Error('Extension failed');
      mockLock.extend.mockRejectedValue(error);

      // Act & Assert
      await expect(service.extendLock(mockLock, 5000)).rejects.toThrow(
        'Unable to extend lock for resources: locks:resource-1, locks:resource-2',
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical workflow: acquire, extend, release', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);
      const extendedLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);
      mockLock.extend.mockResolvedValue(extendedLock);

      // Act
      const lock = await service.acquireLock(resource, 5000);
      const extended = await service.extendLock(lock, 10000);
      await service.releaseLock(extended);

      // Assert
      expect(mockRedlock.acquire).toHaveBeenCalled();
      expect(mockLock.extend).toHaveBeenCalledWith(10000);
      expect(extendedLock.release).toHaveBeenCalled();
    });

    it('should handle withLock for complete operation lifecycle', async () => {
      // Arrange
      const resource = 'user:123:transfer';
      const mockLock = createMockLock([`locks:${resource}`]);
      mockRedlock.acquire.mockResolvedValue(mockLock);

      let operationExecuted = false;
      const operation = jest.fn().mockImplementation(async () => {
        operationExecuted = true;
        // Simulate some async work without real timeouts
        return { success: true, amount: 100 };
      });

      // Act
      const result = await service.withLock(resource, 5000, operation);

      // Assert
      expect(operationExecuted).toBe(true);
      expect(result).toEqual({ success: true, amount: 100 });
      expect(mockRedlock.acquire).toHaveBeenCalled();
      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should handle tryLock for non-blocking checks', async () => {
      // Arrange
      const resource = 'test-resource';
      const mockLock = createMockLock([`locks:${resource}`]);

      // First attempt succeeds
      mockRedlock.acquire.mockResolvedValueOnce(mockLock);

      // Second attempt fails (already locked)
      mockRedlock.acquire.mockRejectedValueOnce(new Error('Already locked'));

      // Act
      const lock1 = await service.tryLock(resource, 5000);
      const lock2 = await service.tryLock(resource, 5000);

      // Assert
      expect(lock1).toBe(mockLock);
      expect(lock2).toBeNull();
    });
  });
});
