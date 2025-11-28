import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { RedisService } from './redis.service';

const BONUS_QUEUE_NAME = 'bonus-calculation';
const LOCK_TTL_SECONDS = 300;

@Injectable()
export class BonusSchedulerCronService {
  private readonly logger = new Logger(BonusSchedulerCronService.name);

  constructor(
    @InjectQueue(BONUS_QUEUE_NAME) private bonusQueue: Queue,
    private redisService: RedisService,
  ) {
    this.logger.log('BonusSchedulerCronService initialized');
  }

  @Cron('0 1 * * *')
  async scheduleDailyBonuses(): Promise<void> {
    await this.executeWithLock('scheduleDailyBonuses', async () => {
      const job = await this.bonusQueue.add('scheduleDailyBonuses', {});
      this.logger.log(`📅 Scheduled daily bonus job: ${job.id}`);
    });
  }

  @Cron('0 2 * * 1')
  async scheduleWeeklyBonuses(): Promise<void> {
    await this.executeWithLock('scheduleWeeklyBonuses', async () => {
      const job = await this.bonusQueue.add('scheduleWeeklyBonuses', {});
      this.logger.log(`📅 Scheduled weekly bonus job: ${job.id}`);
    });
  }

  @Cron('0 3 1 * *')
  async scheduleMonthlyBonuses(): Promise<void> {
    await this.executeWithLock('scheduleMonthlyBonuses', async () => {
      const job = await this.bonusQueue.add('scheduleMonthlyBonuses', {});
      this.logger.log(`📅 Scheduled monthly bonus job: ${job.id}`);
    });
  }

  @Cron('0 4 * * *')
  async scheduleExpireBonuses(): Promise<void> {
    await this.executeWithLock('expireBonuses', async () => {
      const job = await this.bonusQueue.add('expireBonuses', {});
      this.logger.log(`📅 Scheduled expire bonuses job: ${job.id}`);
    });
  }

  private async executeWithLock(jobName: string, callback: () => Promise<void>): Promise<void> {
    const lockKey = `bonus-cron-lock:${jobName}`;
    const instanceId = `${process.pid}-${Date.now()}`;

    try {
      const lockAcquired = await this.redisService.setNX(lockKey, instanceId, LOCK_TTL_SECONDS);

      if (!lockAcquired) {
        this.logger.warn(`Skipped ${jobName}: another instance is already processing`);
        return;
      }

      await callback();
    } catch (error) {
      this.logger.error(`Failed to schedule ${jobName}:`, error);
    } finally {
      await this.redisService.del(lockKey);
    }
  }
}
