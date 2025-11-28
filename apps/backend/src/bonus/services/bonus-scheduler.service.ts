import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BONUS_QUEUE_NAME } from '../constants/bonus-queue.constants';

/**
 * BonusSchedulerService - Manual bonus trigger service
 *
 * NOTE: Automatic scheduling has been moved to bonus-service microservice.
 * This service only provides manual trigger methods for testing/simulation.
 * The bonus-service microservice handles all automatic scheduled bonus processing.
 */
@Injectable()
export class BonusSchedulerService {
  private readonly logger = new Logger(BonusSchedulerService.name);

  constructor(@InjectQueue(BONUS_QUEUE_NAME) private bonusQueue: Queue) {}

  // Manual trigger methods for simulator
  async triggerDailyBonuses(): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const job = await this.bonusQueue.add('scheduleDailyBonuses', {});
      return {
        success: true,
        message: 'Daily bonus processing triggered',
        jobId: job.id,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger daily bonuses: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ✅ Test mode version for testing rakeback with today's activity
  async triggerDailyBonusesTestMode(): Promise<{
    success: boolean;
    message: string;
    jobId?: string;
  }> {
    try {
      const job = await this.bonusQueue.add('scheduleDailyBonusesTestMode', {});
      return {
        success: true,
        message: 'Daily bonus processing triggered in TEST MODE',
        jobId: job.id,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger daily bonuses in test mode: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async triggerWeeklyBonuses(): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const job = await this.bonusQueue.add('scheduleWeeklyBonuses', {});

      this.logger.log(`Manual weekly bonus job triggered: ${job.id}`);
      return {
        success: true,
        message: 'Weekly bonus processing triggered',
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error('Failed to trigger weekly bonuses:', error);
      return {
        success: false,
        message: `Failed to trigger weekly bonuses: ${(error as Error).message}`,
      };
    }
  }

  async triggerMonthlyBonuses(): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const job = await this.bonusQueue.add('scheduleMonthlyBonuses', {});

      this.logger.log(`Manual monthly bonus job triggered: ${job.id}`);
      return {
        success: true,
        message: 'Monthly bonus processing triggered',
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error('Failed to trigger monthly bonuses:', error);
      return {
        success: false,
        message: `Failed to trigger monthly bonuses: ${(error as Error).message}`,
      };
    }
  }

  async triggerBonusExpiration(): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      const job = await this.bonusQueue.add('expireBonuses', {});

      this.logger.log(`Manual bonus expiration job triggered: ${job.id}`);
      return {
        success: true,
        message: 'Bonus expiration processing triggered',
        jobId: job.id,
      };
    } catch (error) {
      this.logger.error('Failed to trigger bonus expiration:', error);
      return {
        success: false,
        message: `Failed to trigger bonus expiration: ${(error as Error).message}`,
      };
    }
  }
}
