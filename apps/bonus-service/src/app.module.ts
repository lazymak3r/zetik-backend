import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BonusSchedulerCronService } from './bonus-scheduler-cron.service';
import { HealthController } from './health.controller';
import { RedisService } from './redis.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['apps/bonus-service/.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: 'bonus-calculation',
    }),
  ],
  controllers: [HealthController],
  providers: [BonusSchedulerCronService, RedisService],
})
export class AppModule {}
