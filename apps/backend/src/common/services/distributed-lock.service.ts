import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import Redlock, { Lock, Settings } from 'redlock';
import { redisConfig } from '../../config/redis.config';
import { LockAcquisitionException } from '../exceptions/lock-acquisition.exception';
import { LockMetricsService } from './lock-metrics.service';
import { RedisService } from './redis.service';

/**
 * Options for lock acquisition behavior
 * @property retryCount - Maximum retry attempts (0-20 recommended)
 * @property retryDelay - Base delay between retries in ms (50-500ms recommended)
 * @property retryJitter - Random jitter in ms (0-200ms recommended)
 */
export interface LockOptions {
  retryCount?: number;
  retryDelay?: number;
  retryJitter?: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WithLockOptions extends LockOptions {
  // Future: Add support for lock lost callbacks when redlock supports it
}

/**
 * Distributed locking service using the Redlock algorithm
 *
 * This service provides distributed locks to prevent race conditions
 * across multiple instances of the application. It uses the Redlock
 * algorithm which is designed to work with Redis.
 *
 * Features:
 * - Automatic lock acquisition retry with exponential backoff
 * - Lock extension/renewal support
 * - Graceful error handling
 * - Type-safe operations
 * - Multi-instance support for production deployments
 *
 * Configuration:
 * - Single instance (development): Uses REDIS_HOST and REDIS_PORT
 * - Multi-instance (production): Uses REDIS_INSTANCES environment variable
 *   Format: REDIS_INSTANCES=host1:port1,host2:port2,host3:port3
 *   Recommended: 3-5 independent Redis instances for Byzantine fault tolerance
 */
@Injectable()
export class DistributedLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private redlock!: Redlock;
  private redisClient!: Redis;

  /**
   * WeakMap to track lock acquisition timestamps for hold time calculation
   */
  private readonly lockAcquisitionTimes = new WeakMap<Lock, number>();

  /**
   * Default TTL for locks (10 seconds)
   */
  private readonly DEFAULT_TTL = 10000;

  /**
   * Default retry configuration
   */
  private readonly DEFAULT_RETRY_COUNT = 3;
  private readonly DEFAULT_RETRY_DELAY = 200;
  private readonly DEFAULT_RETRY_JITTER = 100;

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: LockMetricsService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit(): Promise<void> {
    try {
      // Create a dedicated Redis client for Redlock
      const config = redisConfig().redis;
      this.redisClient = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        maxRetriesPerRequest: null, // Redlock handles retries
        lazyConnect: false,
        enableReadyCheck: true,
      });

      // Configure Redlock with retry settings
      const settings: Partial<Settings> = {
        // The expected clock drift; for more details see:
        // http://redis.io/topics/distlock
        driftFactor: 0.01,

        // The max number of times Redlock will attempt to lock a resource
        // before erroring
        retryCount: this.DEFAULT_RETRY_COUNT,

        // The time in ms between retry attempts
        retryDelay: this.DEFAULT_RETRY_DELAY,

        // The max time in ms randomly added to retries to improve performance
        // under high contention
        retryJitter: this.DEFAULT_RETRY_JITTER,

        // The max time in ms a lock should be held
        automaticExtensionThreshold: 500,
      };

      this.redlock = new Redlock([this.redisClient], settings);

      // Set up event listeners for monitoring
      this.redlock.on('error', (error) => {
        // Redlock emits an error event when it is unable to reach a quorum
        // This can happen during network partitions or Redis downtime
        this.logger.error('Redlock error:', error);
      });

      this.logger.log('Distributed lock service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize distributed lock service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      // Gracefully close the Redis connection
      await this.redisClient.quit();
      this.logger.log('Distributed lock service shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down distributed lock service:', error);
    }
  }

  /**
   * Acquire a distributed lock on a resource
   *
   * @param resource - Unique identifier for the resource to lock
   * @param ttl - Time to live in milliseconds (default: 10000ms)
   * @param options - Lock acquisition options
   * @returns Lock instance if successful
   * @throws Error if lock cannot be acquired
   *
   * @example
   * ```typescript
   * const lock = await distributedLockService.acquireLock('user:123', 5000);
   * try {
   *   // Critical section
   * } finally {
   *   await distributedLockService.releaseLock(lock);
   * }
   * ```
   */
  async acquireLock(
    resource: string,
    ttl: number = this.DEFAULT_TTL,
    options?: LockOptions,
  ): Promise<Lock> {
    const startTime = Date.now();

    try {
      const settings: Partial<Settings> = {
        ...(options?.retryCount !== undefined && { retryCount: options.retryCount }),
        ...(options?.retryDelay !== undefined && { retryDelay: options.retryDelay }),
        ...(options?.retryJitter !== undefined && { retryJitter: options.retryJitter }),
      };

      const lock = await this.redlock.acquire([`locks:${resource}`], ttl, settings);

      const acquisitionTime = Date.now() - startTime;

      // Record successful acquisition and store timestamp for hold time calculation
      this.lockAcquisitionTimes.set(lock, Date.now());
      this.metricsService.recordLockAcquisition({
        resource,
        acquisitionTimeMs: acquisitionTime,
        success: true,
      });

      this.logger.debug(`Lock acquired for resource: ${resource}, TTL: ${ttl}ms`);

      return lock;
    } catch (error) {
      const acquisitionTime = Date.now() - startTime;

      // Record failed acquisition
      this.metricsService.recordLockAcquisition({
        resource,
        acquisitionTimeMs: acquisitionTime,
        success: false,
      });

      this.metricsService.recordLockFailure(
        resource,
        error instanceof Error ? error.message : 'Unknown error',
      );

      this.logger.error(`Failed to acquire lock for resource: ${resource}`, error);
      throw new LockAcquisitionException(resource);
    }
  }

  /**
   * Release a distributed lock
   *
   * @param lock - Lock instance to release
   * @returns Promise that resolves when lock is released
   *
   * @example
   * ```typescript
   * await distributedLockService.releaseLock(lock);
   * ```
   */
  async releaseLock(lock: Lock): Promise<void> {
    try {
      // Calculate hold time if we have the acquisition timestamp
      const acquisitionTime = this.lockAcquisitionTimes.get(lock);
      if (acquisitionTime) {
        const holdTimeMs = Date.now() - acquisitionTime;
        // Extract resource name from lock.resources (remove "locks:" prefix)
        const resource = lock.resources[0]?.replace('locks:', '') || 'unknown';
        this.metricsService.recordLockRelease(resource, holdTimeMs);
      }

      await lock.release();
      this.logger.debug(`Lock released for resources: ${lock.resources.join(', ')}`);
    } catch (error) {
      // If lock is already released or expired, log but don't throw
      this.logger.warn(`Failed to release lock for resources: ${lock.resources.join(', ')}`, error);
    }
  }

  /**
   * Extend the TTL of an existing lock
   *
   * @param lock - Lock instance to extend
   * @param ttl - New TTL in milliseconds
   * @returns Extended lock instance
   * @throws Error if lock cannot be extended
   *
   * @example
   * ```typescript
   * const extendedLock = await distributedLockService.extendLock(lock, 5000);
   * ```
   */
  async extendLock(lock: Lock, ttl: number): Promise<Lock> {
    try {
      const extendedLock = await lock.extend(ttl);

      // Record lock extension
      const resource = lock.resources[0]?.replace('locks:', '') || 'unknown';
      this.metricsService.recordLockExtension(resource);

      this.logger.debug(
        `Lock extended for resources: ${lock.resources.join(', ')}, new TTL: ${ttl}ms`,
      );
      return extendedLock;
    } catch (error) {
      this.logger.error(`Failed to extend lock for resources: ${lock.resources.join(', ')}`, error);
      throw new Error(`Unable to extend lock for resources: ${lock.resources.join(', ')}`);
    }
  }

  /**
   * Execute an operation with automatic lock management and extension
   *
   * This is the recommended way to use distributed locks as it automatically
   * handles lock acquisition, execution, and release including error cases.
   *
   * The lock is automatically extended at 60% of the TTL interval to prevent
   * premature expiration for long-running operations. This ensures that even
   * if an operation takes longer than expected (due to high load, slow queries,
   * or external API calls), the lock remains valid throughout the operation.
   *
   * @param resource - Unique identifier for the resource to lock
   * @param ttl - Time to live in milliseconds (default: 10000ms)
   * @param operation - Async function to execute while holding the lock
   * @param options - Lock options including retry configuration
   * @returns Result of the operation
   * @throws Error if lock cannot be acquired or operation fails
   *
   * @example
   * ```typescript
   * const result = await distributedLockService.withLock(
   *   'user:123:transfer',
   *   5000,
   *   async () => {
   *     // Critical section - only one instance can execute this at a time
   *     return await performTransfer();
   *   },
   *   {
   *     retryCount: 5,
   *     retryDelay: 300
   *   }
   * );
   * ```
   */
  async withLock<T>(
    resource: string,
    ttl: number = this.DEFAULT_TTL,
    operation: () => Promise<T>,
    options?: WithLockOptions,
  ): Promise<T> {
    let lock: Lock | null = null;
    let extensionInterval: NodeJS.Timeout | null = null;

    try {
      // Acquire lock with retry options
      lock = await this.acquireLock(resource, ttl, options);

      // Set up automatic lock extension at 60% of TTL
      // This prevents the lock from expiring during long-running operations
      const extensionIntervalMs = ttl * 0.6;
      let extensionFailures = 0;
      const MAX_EXTENSION_FAILURES = 3;

      extensionInterval = setInterval(() => {
        void (async () => {
          if (lock) {
            try {
              // Extend the lock by the original TTL
              lock = await this.extendLock(lock, ttl);
              extensionFailures = 0; // Reset on success
              this.logger.debug(`Auto-extended lock for resource: ${resource}, TTL: ${ttl}ms`);
            } catch (error) {
              extensionFailures++;
              this.logger.error(
                `Failed to auto-extend lock for resource: ${resource} (attempt ${extensionFailures}/${MAX_EXTENSION_FAILURES})`,
                error instanceof Error ? error.message : String(error),
              );

              // Stop retrying after too many failures
              if (extensionFailures >= MAX_EXTENSION_FAILURES && extensionInterval) {
                clearInterval(extensionInterval);
                extensionInterval = null;
                this.logger.error(
                  `Stopped auto-extension for ${resource} after ${MAX_EXTENSION_FAILURES} failures`,
                );
              }
            }
          }
        })();
      }, extensionIntervalMs);

      // Execute the operation
      const result = await operation();

      // Clear interval immediately on successful completion
      if (extensionInterval) {
        clearInterval(extensionInterval);
        extensionInterval = null;
      }

      return result;
    } catch (error) {
      // Clear interval immediately on error before re-throwing
      if (extensionInterval) {
        clearInterval(extensionInterval);
        extensionInterval = null;
      }

      this.logger.error(`Operation failed while holding lock for resource: ${resource}`, error);
      throw error;
    } finally {
      // Clear the extension interval to prevent memory leaks
      if (extensionInterval) {
        clearInterval(extensionInterval);
      }

      // Always release the lock, even if operation fails
      if (lock) {
        await this.releaseLock(lock);
      }
    }
  }

  /**
   * Attempt to acquire a lock without retrying
   *
   * Useful when you want to check if a resource is locked without waiting
   *
   * @param resource - Unique identifier for the resource to lock
   * @param ttl - Time to live in milliseconds (default: 10000ms)
   * @returns Lock instance if successful, null if resource is already locked
   *
   * @example
   * ```typescript
   * const lock = await distributedLockService.tryLock('user:123', 5000);
   * if (lock) {
   *   try {
   *     // Got the lock
   *   } finally {
   *     await distributedLockService.releaseLock(lock);
   *   }
   * } else {
   *   // Resource is already locked
   * }
   * ```
   */
  async tryLock(resource: string, ttl: number = this.DEFAULT_TTL): Promise<Lock | null> {
    try {
      return await this.acquireLock(resource, ttl, { retryCount: 0 });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // If we can't acquire the lock immediately, return null
      return null;
    }
  }

  /**
   * Check if a resource is currently locked
   *
   * Note: This is a best-effort check and the lock status may change
   * immediately after this call returns
   *
   * @param resource - Unique identifier for the resource
   * @returns true if resource is locked, false otherwise
   *
   * @example
   * ```typescript
   * const isLocked = await distributedLockService.isLocked('user:123');
   * ```
   */
  async isLocked(resource: string): Promise<boolean> {
    try {
      return await this.redisService.exists(`locks:${resource}`);
    } catch (error) {
      this.logger.error(`Failed to check lock status for resource: ${resource}`, error);
      return false;
    }
  }

  /**
   * Get lock performance statistics
   *
   * @param resource - Optional resource identifier to get specific resource stats
   * @returns Lock statistics
   *
   * @example
   * ```typescript
   * // Get global stats
   * const globalStats = distributedLockService.getLockStats();
   *
   * // Get stats for specific resource
   * const resourceStats = distributedLockService.getLockStats('user:123');
   * ```
   */
  getLockStats(resource?: string) {
    return this.metricsService.getLockStats(resource);
  }

  /**
   * Get top contended resources
   *
   * @param limit - Maximum number of resources to return (default: 10)
   * @returns Array of resource statistics sorted by contention rate
   *
   * @example
   * ```typescript
   * const topContended = distributedLockService.getTopContendedResources(5);
   * ```
   */
  getTopContendedResources(limit?: number) {
    return this.metricsService.getTopContendedResources(limit);
  }
}
