/**
 * Standardized TTL (Time To Live) constants for distributed locks.
 * All values are in milliseconds.
 *
 * TTLs have been increased from previous values to accommodate:
 * - Database query latency under high load
 * - Network latency for external API calls
 * - Multi-step operations that require atomicity
 *
 * Auto-extension is implemented in DistributedLockService to prevent
 * premature lock expiration for long-running operations.
 */
export enum LockTTL {
  /**
   * Fast operations: Simple balance updates, single DB queries
   * Previously: 5000ms (5s)
   * Now: 10000ms (10s)
   */
  FAST_OPERATION = 10000,

  /**
   * Standard operations: Most typical operations, multiple DB queries
   * Previously: 10000ms (10s)
   * Now: 15000ms (15s)
   */
  STANDARD_OPERATION = 15000,

  /**
   * Complex operations: Multi-step operations with multiple queries
   * New tier for complex game logic and calculations
   */
  COMPLEX_OPERATION = 20000,

  /**
   * Batch operations: Processing multiple items in sequence
   * For operations that iterate over multiple records
   */
  BATCH_OPERATION = 25000,

  /**
   * External API calls: Integration with third-party services
   * Includes Fireblocks API calls, webhook processing
   */
  EXTERNAL_API_CALL = 30000,
}
