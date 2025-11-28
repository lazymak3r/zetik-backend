/**
 * Generic in-memory cache with TTL (Time To Live) expiration
 * Automatically removes expired entries on access
 *
 * @template T - Type of cached value
 */
export class TtlMemoryCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Get value from cache if not expired
   * Automatically removes expired entries
   */
  get(key: string): T | undefined {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    // Check if expired
    if (now >= cached.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return cached.value;
  }

  /**
   * Set value in cache with TTL expiration
   */
  set(key: string, value: T): void {
    const now = Date.now();
    const expiresAt = now + this.ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (!cached) {
      return false;
    }

    // Check if expired
    if (now >= cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get cache size (including expired entries)
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get all non-expired entries
   */
  entries(): Array<[string, T]> {
    const now = Date.now();
    const result: Array<[string, T]> = [];

    for (const [key, data] of this.cache.entries()) {
      if (now < data.expiresAt) {
        result.push([key, data.value]);
      }
    }

    return result;
  }

  /**
   * Clean up all expired entries
   * Returns number of entries cleaned
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of this.cache.entries()) {
      if (now >= data.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}
