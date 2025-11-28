/**
 * Metrics data for a single lock operation
 */
export interface LockMetrics {
  /** Resource identifier for the lock */
  resource: string;

  /** Time taken to acquire the lock in milliseconds */
  acquisitionTimeMs: number;

  /** Total time the lock was held in milliseconds (set on release) */
  holdTimeMs?: number;

  /** Whether the lock acquisition was successful */
  success: boolean;

  /** Whether the lock was extended */
  extended?: boolean;

  /** Number of times the lock was extended */
  extensionCount?: number;
}

/**
 * Interface for lock metrics service
 */
export interface ILockMetricsService {
  /**
   * Record a lock acquisition attempt
   */
  recordLockAcquisition(metrics: LockMetrics): void;

  /**
   * Record a lock release
   */
  recordLockRelease(resource: string, holdTimeMs: number): void;

  /**
   * Record a lock extension
   */
  recordLockExtension(resource: string): void;

  /**
   * Record a lock failure
   */
  recordLockFailure(resource: string, reason: string): void;

  /**
   * Get lock statistics for a specific resource or all resources
   */
  getLockStats(resource?: string): LockStats;

  /**
   * Get statistics for top contended resources
   */
  getTopContendedResources(limit?: number): ResourceStats[];
}

/**
 * Statistics for lock operations
 */
export interface LockStats {
  /** Total number of lock acquisition attempts */
  totalAcquisitions: number;

  /** Number of successful lock acquisitions */
  successfulAcquisitions: number;

  /** Number of failed lock acquisitions */
  failedAcquisitions: number;

  /** Average time to acquire a lock in milliseconds */
  averageAcquisitionTime: number;

  /** Average time a lock is held in milliseconds */
  averageHoldTime: number;

  /** Total number of lock extensions */
  totalExtensions: number;

  /** Per-resource statistics (only present in global stats) */
  resourceStats?: Map<string, ResourceStats>;
}

/**
 * Statistics for a specific resource
 */
export interface ResourceStats {
  /** Resource identifier */
  resource: string;

  /** Total number of acquisitions for this resource */
  acquisitions: number;

  /** Number of successful acquisitions */
  successful: number;

  /** Number of failed acquisitions */
  failed: number;

  /** Average acquisition time in milliseconds */
  avgAcquisitionTime: number;

  /** Average hold time in milliseconds */
  avgHoldTime: number;

  /** Total extensions */
  extensions: number;

  /** Contention rate (failed / total) */
  contentionRate: number;
}

/**
 * Internal metric entry stored in memory
 */
export interface MetricEntry {
  timestamp: number;
  resource: string;
  acquisitionTimeMs: number;
  holdTimeMs?: number;
  success: boolean;
  extended?: boolean;
  extensionCount?: number;
  failureReason?: string;
}
