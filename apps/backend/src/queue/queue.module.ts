import { BullModule } from '@nestjs/bullmq';
import { Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { redisConfig } from '../config/redis.config';

@Injectable()
export class QueueHealthService implements OnModuleInit {
  private readonly logger = new Logger(QueueHealthService.name);

  async onModuleInit() {
    await this.checkRedisConnection();
  }

  private async checkRedisConnection(): Promise<void> {
    try {
      const config = redisConfig().redis;
      if (!config) {
        throw new Error('Redis configuration not found');
      }

      const redis = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        maxRetriesPerRequest: 3,
      });

      await redis.ping();
      this.logger.log(`Redis connected successfully at ${config.host}:${config.port}`);
      this.logger.log(`BullMQ queues ready for use`);

      await redis.quit();
    } catch (error) {
      this.logger.error(`❌ Redis connection failed: ${(error as Error).message}`);
      throw error;
    }
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const config = redisConfig().redis;
        if (!config) {
          throw new Error('Redis configuration not found');
        }
        return {
          connection: {
            host: config.host,
            port: config.port,
            password: config.password,
            db: config.db,
          },
        };
      },
    }),
  ],
  providers: [QueueHealthService],
  exports: [BullModule],
})
export class QueueModule {}
