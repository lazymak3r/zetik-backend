import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, RedisClientType } from 'redis';
import { ServerOptions } from 'socket.io';

/**
 * Redis adapter for Socket.io to enable cross-process WebSocket broadcasting
 * This allows WebSocket events to be broadcast across all services (bet-feed-service and main backend)
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
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD;
    const redisDb = parseInt(process.env.REDIS_DB || '0', 10);

    this.logger.log(`Connecting to Redis at ${redisHost}:${redisPort} for WebSocket adapter`);

    // Create pub/sub clients for Socket.io
    const pubClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
      password: redisPassword,
      database: redisDb,
    }) as RedisClientType;

    const subClient = pubClient.duplicate() as RedisClientType;

    // Handle errors with logging
    pubClient.on('error', (err) => {
      this.logger.error('❌ Redis pub client error:', err);
      // ioredis handles reconnection automatically
    });

    subClient.on('error', (err) => {
      this.logger.error('❌ Redis sub client error:', err);
      // ioredis handles reconnection automatically
    });

    // Handle reconnection
    pubClient.on('reconnecting', () => {
      this.logger.log('🔄 Redis pub client reconnecting...');
    });

    subClient.on('reconnecting', () => {
      this.logger.log('🔄 Redis sub client reconnecting...');
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
      this.logger.log('Socket.io server using Redis adapter for cross-service broadcasting');
    } else {
      this.logger.warn('Redis adapter not initialized, using default adapter');
    }

    return server;
  }

  async close(): Promise<void> {
    this.logger.log('Closing Redis WebSocket adapter connections...');

    if (this.pubClient) {
      await this.pubClient.quit();
    }

    if (this.subClient) {
      await this.subClient.quit();
    }

    this.logger.log('Redis WebSocket adapter connections closed');
  }
}
