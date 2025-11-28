import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  SELF_EXCLUSION_QUEUE_NAME,
  SelfExclusionJobType,
} from './constants/self-exclusion-queue.constants';

@Injectable()
export class SelfExclusionSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SelfExclusionSchedulerService.name);

  constructor(
    @InjectQueue(SELF_EXCLUSION_QUEUE_NAME)
    private readonly selfExclusionQueue: Queue,
  ) {}

  async onModuleInit() {
    // Set up repeatable job for expiring outdated self-exclusions
    // Runs every 5 minutes, only one worker will process it
    await this.setupExpirationJob();
  }

  private async setupExpirationJob() {
    try {
      // Remove any existing repeatable jobs with the same name
      const repeatableJobs = await this.selfExclusionQueue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.name === String(SelfExclusionJobType.EXPIRE_OUTDATED)) {
          await this.selfExclusionQueue.removeRepeatableByKey(job.key);
          this.logger.log(`Removed existing repeatable job: ${job.key}`);
        }
      }

      // Add new repeatable job
      await this.selfExclusionQueue.add(
        SelfExclusionJobType.EXPIRE_OUTDATED,
        {
          type: SelfExclusionJobType.EXPIRE_OUTDATED,
        },
        {
          repeat: {
            pattern: '*/5 * * * *', // Every 5 minutes (cron syntax)
          },
          removeOnComplete: {
            count: 10, // Keep last 10 completed jobs for debugging
          },
          removeOnFail: {
            count: 50, // Keep last 50 failed jobs for debugging
          },
        },
      );

      this.logger.log('Self-exclusion expiration job scheduled (every 5 minutes)');
    } catch (error) {
      this.logger.error('Failed to setup self-exclusion expiration job:', error);
      throw error;
    }
  }

  /**
   * Manually trigger the expiration job (for testing)
   */
  async triggerExpirationNow(): Promise<void> {
    await this.selfExclusionQueue.add(SelfExclusionJobType.EXPIRE_OUTDATED, {
      type: SelfExclusionJobType.EXPIRE_OUTDATED,
    });
    this.logger.log('Manually triggered self-exclusion expiration');
  }
}
