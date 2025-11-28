import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controllers/health.controller';
import { DistributedLockService } from './services/distributed-lock.service';
import { FeeCacheService } from './services/fee-cache.service';
import { LockMetricsService } from './services/lock-metrics.service';
import { LoggerService } from './services/logger.service';
import { RedisService } from './services/redis.service';
import { UserCacheService } from './services/user-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [
    RedisService,
    LoggerService,
    UserCacheService,
    LockMetricsService,
    DistributedLockService,
    FeeCacheService,
  ],
  exports: [
    RedisService,
    LoggerService,
    UserCacheService,
    LockMetricsService,
    DistributedLockService,
    FeeCacheService,
  ],
})
export class CommonModule {}
