import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing RedisService...');
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    await new Promise<void>((resolve) => {
      this.client.once('connect', () => {
        this.logger.log('Redis connected successfully');
        resolve();
      });
    });

    this.logger.log('RedisService initialized');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}
