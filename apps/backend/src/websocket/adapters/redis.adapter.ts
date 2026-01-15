import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';
import { redisConfig } from '../../config/redis.config';

/**
 * Redis adapter for Socket.io to enable cross-process WebSocket broadcasting
 * This allows WebSocket events to be broadcast across all worker processes
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private pubClient: RedisClientType | null = null;
  private subClient: RedisClientType | null = null;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const config = redisConfig().redis;

    if (!config) {
      throw new Error('Redis configuration not found');
    }

    this.logger.log(`Connecting to Redis at ${config.host}:${config.port} for WebSocket adapter`);

    // Create pub/sub clients for Socket.io
    const pubClient = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.db,
    }) as RedisClientType;

    const subClient = pubClient.duplicate() as RedisClientType;

    // Handle errors
    pubClient.on('error', (err) => {
      this.logger.error('Redis pub client error:', err);
    });

    subClient.on('error', (err) => {
      this.logger.error('Redis sub client error:', err);
    });

    // Connect both clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.pubClient = pubClient;
    this.subClient = subClient;

    this.adapterConstructor = createAdapter(pubClient, subClient);

    this.logger.log('✅ Redis adapter for Socket.io connected successfully');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
      this.logger.log('Socket.io server using Redis adapter for multi-process support');
    } else {
      this.logger.warn('Redis adapter not initialized, using default adapter');
    }

    return server;
  }

  async close(): Promise<void> {
    this.logger.log('Closing Redis WebSocket adapter connections...');

    try {
      if (this.pubClient?.isOpen) {
        await this.pubClient.quit();
      }
    } catch (error) {
      this.logger.warn('Error closing pub client:', error);
    }

    try {
      if (this.subClient?.isOpen) {
        await this.subClient.quit();
      }
    } catch (error) {
      this.logger.warn('Error closing sub client:', error);
    }

    this.logger.log('Redis WebSocket adapter connections closed');
  }
}
