import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private redis: Redis;

  constructor() {
    const config = redisConfig().redis;
    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      this.logger.log('Redis module initialized and connected');
    } catch (error) {
      this.logger.error('Failed to connect to Redis on module init:', error);
    }
  }

  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      let result: string | null;

      if (ttlSeconds) {
        result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      } else {
        result = await this.redis.set(key, value, 'NX');
      }

      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to setNX key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      return false;
    }
  }

  async hincrby(key: string, field: string, increment: number): Promise<number> {
    try {
      return await this.redis.hincrby(key, field, increment);
    } catch (error) {
      this.logger.error(`Failed to hincrby key ${key} field ${field}:`, error);
      throw error;
    }
  }

  async hdel(key: string, field: string): Promise<boolean> {
    try {
      const result = await this.redis.hdel(key, field);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to hdel key ${key} field ${field}:`, error);
      return false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        const result = await this.redis.set(key, value, 'EX', ttlSeconds);
        return result === 'OK';
      } else {
        const result = await this.redis.set(key, value);
        return result === 'OK';
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error);
    }
  }

  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Failed to sadd to key ${key}:`, error);
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.redis.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Failed to srem from key ${key}:`, error);
      return 0;
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.redis.scard(key);
    } catch (error) {
      this.logger.error(`Failed to scard key ${key}:`, error);
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.redis.smembers(key);
    } catch (error) {
      this.logger.error(`Failed to smembers key ${key}:`, error);
      return [];
    }
  }

  /**
   * Check if a member exists in a Redis set
   * @param key Redis set key
   * @param member Member to check
   * @returns true if member exists in set, false otherwise
   */
  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.redis.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check sismember for key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to check exists for key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to expire key ${key}:`, error);
      return false;
    }
  }

  async scan(cursor: string, pattern: string, count: number = 100): Promise<[string, string[]]> {
    try {
      // ioredis scan method returns [nextCursor, keys[]]
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', count);
      return result as [string, string[]];
    } catch (error) {
      this.logger.error(`Failed to scan with pattern ${pattern}:`, error);
      return ['0', []];
    }
  }
  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<any> {
    try {
      return await this.redis.eval(script, numKeys, ...args);
    } catch (error) {
      this.logger.error('Failed to execute Lua script:', error);
      throw error;
    }
  }

  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return this.set(key, value, ttlSeconds);
  }

  async delete(key: string): Promise<boolean> {
    return this.del(key);
  }

  async sAdd(key: string, ...members: string[]): Promise<number> {
    return this.sadd(key, ...members);
  }

  /**
   * Atomically remove member from set only if it exists
   * Uses Lua script to prevent race conditions
   * @param key Redis set key
   * @param member Member to remove
   * @returns true if member was removed, false otherwise
   */
  async sremIfExists(key: string, member: string): Promise<boolean> {
    try {
      // Lua script that removes member only if it exists
      const script = `
        if redis.call('sismember', KEYS[1], ARGV[1]) == 1 then
          return redis.call('srem', KEYS[1], ARGV[1])
        else
          return 0
        end
      `;
      const result = await this.redis.eval(script, 1, key, member);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to sremIfExists for key ${key}:`, error);
      return false;
    }
  }

  getClient(): Redis {
    return this.redis;
  }
}
