import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { Job } from 'bullmq';
import { In, Repository } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { RedisService } from '../../common/services/redis.service';
import { BONUS_QUEUE_NAME } from '../constants/bonus-queue.constants';
import { IBonusJobData, IBonusJobResult } from '../interfaces/bonus-job-data.interface';
import { IUserVipStatus, IVipTier } from '../interfaces/vip-entities.interface';
import { BonusNotificationService } from './bonus-notification.service';
import { UserVipStatusService } from './user-vip-status.service';
import { VipTierService } from './vip-tier.service';

interface IUserWithVipTier {
  id: string;
  tier: IVipTier;
}

interface IBalanceStats {
  userId: string;
  bets: string;
  refunds: string;
  wins: string;
  effectiveEdgeCents: string;
}

@Processor(BONUS_QUEUE_NAME)
@Injectable()
export class BonusCalculationProcessor extends WorkerHost {
  private readonly logger = new Logger(BonusCalculationProcessor.name);

  constructor(
    private readonly userVipStatusService: UserVipStatusService,
    private readonly vipTierService: VipTierService,
    private readonly balanceService: BalanceService,
    private readonly redisService: RedisService,
    @InjectRepository(BonusTransactionEntity)
    private readonly bonusTransactionRepository: Repository<BonusTransactionEntity>,
    private readonly bonusNotificationService: BonusNotificationService,
  ) {
    super();
  }

  // Manual methods for scheduler jobs (called by BonusSchedulerService)
  async scheduleDailyBonuses(): Promise<void> {
    this.logger.log('Processing scheduled daily bonuses...');

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processDailyBonusesBatch(
      users,
      `daily-${new Date().toISOString().split('T')[0]}`,
      false, // Production mode: use yesterday's data
    );
  }

  // ✅ Test version that calculates bonuses from today's activity
  async scheduleDailyBonusesTestMode(): Promise<void> {
    this.logger.log("Processing daily bonuses in TEST MODE (using today's activity)...");

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processDailyBonusesBatch(
      users,
      `daily-test-${new Date().toISOString().split('T')[0]}-${Date.now()}`,
      true, // Test mode: use today's data
    );
  }

  async scheduleWeeklyBonuses(): Promise<void> {
    this.logger.log('Processing scheduled weekly bonuses...');

    const today = new Date();
    const weekStart = new Date();
    weekStart.setDate(today.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processWeeklyBonusesBatch(users, `weekly-${new Date().toISOString().split('T')[0]}`);
  }

  // ✅ Test version that calculates weekly bonuses using a short window around now
  async scheduleWeeklyBonusesTestMode(): Promise<void> {
    this.logger.log('Processing weekly bonuses in TEST MODE (using recent activity)...');

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processWeeklyBonusesBatch(
      users,
      `weekly-test-${new Date().toISOString().split('T')[0]}-${Date.now()}`,
    );
  }

  async scheduleMonthlyBonuses(): Promise<void> {
    this.logger.log('Processing scheduled monthly bonuses...');

    // Calculate previous month (the month we're awarding bonuses for)
    const today = new Date();
    const monthStart = new Date();
    const monthEnd = new Date();

    // Previous month's first day
    monthStart.setUTCMonth(today.getUTCMonth() - 1, 1);
    monthStart.setUTCHours(0, 0, 0, 0);

    // Previous month's last day
    monthEnd.setUTCMonth(today.getUTCMonth(), 0); // Day 0 = last day of previous month
    monthEnd.setUTCHours(23, 59, 59, 999);

    this.logger.log(
      `📅 Monthly bonus period: ${monthStart.toISOString()} to ${monthEnd.toISOString()}`,
    );

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processMonthlyBonusesBatch(
      users,
      `monthly-${new Date().toISOString().split('T')[0]}`,
      '',
      monthStart,
      monthEnd,
    );
  }

  // ✅ Test version that calculates monthly bonuses using current month including today
  async scheduleMonthlyBonusesTestMode(): Promise<void> {
    this.logger.log('Processing monthly bonuses in TEST MODE (current month to date)...');

    const statuses = await this.userVipStatusService.findAllUserVipStatus();
    const users = await this.getUsersWithVipTiers(statuses);

    await this.processMonthlyBonusesBatch(
      users,
      `monthly-test-${new Date().toISOString().split('T')[0]}-${Date.now()}`,
    );
  }

  async expireBonuses(): Promise<void> {
    this.logger.log('Processing bonus expiration...');

    const now = new Date();

    // Only expire bonuses where expiredAt has passed
    const expiredCount = await this.bonusTransactionRepository
      .createQueryBuilder()
      .update(BonusTransactionEntity)
      .set({
        status: BonusTransactionStatusEnum.EXPIRED,
      })
      .where('status = :status', { status: BonusTransactionStatusEnum.PENDING })
      .andWhere('expiredAt IS NOT NULL')
      .andWhere('expiredAt <= :now', { now })
      .execute();

    this.logger.log(`Expired ${expiredCount.affected} bonuses that passed their expiration date`);
  }

  // Batch processing methods with collision protection
  private async processDailyBonusesBatch(
    users: IUserWithVipTier[],
    jobId: string,
    testMode = false,
  ): Promise<void> {
    const userIds = users.map((u) => u.id);
    this.logger.log(`🔍 DEBUG: Processing ${users.length} users for daily bonuses`);

    // ✅ Business logic: calculate for previous day (default)
    // ✅ Test mode: calculate for current day (testable)
    const dayStart = new Date();
    const dayEnd = new Date();

    if (testMode) {
      // Test mode: use today's activity (expanded range to handle timezone issues)
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setDate(dayEnd.getDate() + 1); // Include next day to handle timezone differences
      dayEnd.setHours(23, 59, 59, 999);
      this.logger.log(
        `TEST MODE: Processing daily bonuses for current day ${dayStart.toISOString().split('T')[0]} (expanded range to handle timezones)`,
      );
    } else {
      // Production mode: use yesterday's activity
      dayStart.setDate(dayStart.getDate() - 1);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setDate(dayEnd.getDate() - 1);
      dayEnd.setHours(23, 59, 59, 999);
      this.logger.log(
        `PRODUCTION MODE: Processing daily bonuses for previous day ${dayStart.toISOString().split('T')[0]}`,
      );
    }

    const allStats = await this.getBalanceStats(userIds, dayStart, dayEnd);
    this.logger.log(`🔍 DEBUG: Retrieved ${allStats.length} stats records`);
    this.logger.log(`🔍 DEBUG: Stats data:`, allStats);

    const statsMap = new Map(allStats.map((s) => [s.userId, s]));

    const bonusPromises: Promise<void>[] = [];

    for (const user of users) {
      this.logger.log(
        `🔍 DEBUG: Processing user ${user.id}, level ${user.tier?.level}, tier name: ${user.tier?.name}`,
      );

      const userStats = statsMap.get(user.id);
      if (!userStats) {
        this.logger.log(`⚠️ DEBUG: No stats found for user ${user.id}`);
        continue;
      }

      this.logger.log(
        `🔍 DEBUG: User ${user.id} stats - bets: ${userStats.bets}, wins: ${userStats.wins}, refunds: ${userStats.refunds}`,
      );

      // Daily bonus removed
      // Rakeback bonus is now handled by immediate rakeback system
    }

    this.logger.log(`🔍 DEBUG: Total bonus promises to execute: ${bonusPromises.length}`);
    await Promise.all(bonusPromises);
    this.logger.log(`✅ DEBUG: All bonus promises completed`);
  }

  private async processWeeklyBonusesBatch(
    users: IUserWithVipTier[],
    jobId: string,
    periodKeySuffix: string = '',
  ): Promise<void> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date();
    weekEnd.setHours(23, 59, 59, 999);

    const eligibleUsers = users.filter((user) => {
      const weeklyPercentage = user.tier.weeklyBonusPercentage
        ? parseFloat(user.tier.weeklyBonusPercentage) / 100
        : 0;
      return weeklyPercentage > 0;
    });

    if (eligibleUsers.length === 0) {
      this.logger.log('No users eligible for weekly bonus (all have 0% weekly bonus percentage)');
      return;
    }

    const userIds = eligibleUsers.map((u) => u.id);
    const allStats = await this.getBalanceStats(userIds, weekStart, weekEnd);
    const statsMap = new Map(allStats.map((s) => [s.userId, s]));

    const bonusPromises: Promise<void>[] = [];

    for (const user of eligibleUsers) {
      const userStats = statsMap.get(user.id);
      if (!userStats) continue;

      const weeklyBonus = this.calculateWeeklyBonus(
        user.tier,
        userStats.bets,
        userStats.wins,
        userStats.refunds,
        userStats.effectiveEdgeCents,
      );
      if (weeklyBonus && parseFloat(weeklyBonus) > 0) {
        if (periodKeySuffix) {
          const baseKey = this.getPeriodKey(BonusTypeEnum.WEEKLY_AWARD, weekStart);
          await this.awardBonus(
            user.id,
            weeklyBonus,
            BonusTypeEnum.WEEKLY_AWARD,
            `${baseKey}-${periodKeySuffix}`,
          );
        } else {
          bonusPromises.push(
            this.awardBonusWithProtection(
              user.id,
              weeklyBonus,
              BonusTypeEnum.WEEKLY_AWARD,
              jobId,
              weekStart,
            ),
          );
        }
      }
    }

    await Promise.all(bonusPromises);
  }

  private async processMonthlyBonusesBatch(
    users: IUserWithVipTier[],
    jobId: string,
    periodKeySuffix: string = '',
    monthStart?: Date,
    monthEnd?: Date,
  ): Promise<void> {
    // Use provided dates or calculate default (for test mode)
    if (!monthStart || !monthEnd) {
      const defaultMonthStart = new Date();
      defaultMonthStart.setDate(1);
      defaultMonthStart.setHours(0, 0, 0, 0);
      const defaultMonthEnd = new Date();
      defaultMonthEnd.setHours(23, 59, 59, 999);
      monthStart = defaultMonthStart;
      monthEnd = defaultMonthEnd;
    }

    const eligibleUsers = users.filter((user) => {
      const monthlyPercentage = user.tier.monthlyBonusPercentage
        ? parseFloat(user.tier.monthlyBonusPercentage) / 100
        : 0;
      return monthlyPercentage > 0;
    });

    if (eligibleUsers.length === 0) {
      this.logger.log('No users eligible for monthly bonus (all have 0% monthly bonus percentage)');
      return;
    }

    const userIds = eligibleUsers.map((u) => u.id);
    const allStats = await this.getBalanceStats(userIds, monthStart, monthEnd);
    const statsMap = new Map(allStats.map((s) => [s.userId, s]));

    const bonusPromises: Promise<void>[] = [];

    for (const user of eligibleUsers) {
      const userStats = statsMap.get(user.id);
      if (!userStats) continue;

      const monthlyBonus = this.calculateMonthlyBonus(
        user.tier,
        userStats.bets,
        userStats.wins,
        userStats.refunds,
        userStats.effectiveEdgeCents,
      );
      if (monthlyBonus && parseFloat(monthlyBonus) > 0) {
        if (periodKeySuffix) {
          const baseKey = this.getPeriodKey(BonusTypeEnum.MONTHLY_AWARD, monthStart);
          await this.awardBonus(
            user.id,
            monthlyBonus,
            BonusTypeEnum.MONTHLY_AWARD,
            `${baseKey}-${periodKeySuffix}`,
          );
        } else {
          bonusPromises.push(
            this.awardBonusWithProtection(
              user.id,
              monthlyBonus,
              BonusTypeEnum.MONTHLY_AWARD,
              jobId,
              monthStart,
            ),
          );
        }
      }
    }

    await Promise.all(bonusPromises);
  }

  // Redis collision protection methods
  private async awardBonusWithProtection(
    userId: string,
    amount: string,
    bonusType: BonusTypeEnum,
    jobId: string,
    periodStart: Date,
  ): Promise<void> {
    const periodKey = this.getPeriodKey(bonusType, periodStart);
    const lockKey = `bonus-lock:${userId}:${bonusType}:${periodKey}`;

    // Try to acquire lock with Redis
    const lockAcquired = await this.redisService.setNX(lockKey, jobId, 300); // 5 min TTL

    if (!lockAcquired) {
      this.logger.warn(
        `Bonus already processed for user ${userId}, type ${bonusType}, period ${periodKey}`,
      );
      return;
    }

    try {
      // Check if bonus already exists in database
      const existingBonus = await this.bonusTransactionRepository.findOne({
        where: {
          userId,
          bonusType,
          metadata: { periodKey },
          status: In([BonusTransactionStatusEnum.PENDING, BonusTransactionStatusEnum.CLAIMED]),
        },
      });

      if (existingBonus) {
        this.logger.warn(
          `Duplicate bonus detected in DB for user ${userId}, type ${bonusType}, period ${periodKey}`,
        );
        return;
      }

      // Award bonus
      await this.awardBonus(userId, amount, bonusType, periodKey);

      this.logger.log(
        `Bonus awarded: ${amount} cents to user ${userId} (${bonusType}, ${periodKey})`,
      );
    } finally {
      // Always release lock
      await this.redisService.del(lockKey);
    }
  }

  private getPeriodKey(bonusType: BonusTypeEnum, periodStart: Date): string {
    const dateStr = periodStart.toISOString().split('T')[0];

    switch (bonusType) {
      case BonusTypeEnum.WEEKLY_AWARD:
        return `weekly-${dateStr}`;
      case BonusTypeEnum.MONTHLY_AWARD:
        return `monthly-${dateStr.substring(0, 7)}`; // YYYY-MM
      default:
        return dateStr;
    }
  }

  private async awardBonus(
    userId: string,
    amount: string,
    bonusType: BonusTypeEnum,
    periodKey: string,
  ): Promise<void> {
    // Calculate expiredAt based on bonus type
    let expiredAt: Date;

    if (bonusType === BonusTypeEnum.WEEKLY_AWARD) {
      // Expire at the next Monday (when next weekly bonus is calculated)
      expiredAt = new Date();
      const dayOfWeek = expiredAt.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
      expiredAt.setUTCDate(expiredAt.getUTCDate() + daysUntilNextMonday);
      expiredAt.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
    } else if (bonusType === BonusTypeEnum.MONTHLY_AWARD) {
      // Expire at the first day of next month (when next monthly bonus is calculated)
      expiredAt = new Date();
      expiredAt.setUTCMonth(expiredAt.getUTCMonth() + 1, 1); // First day of next month in UTC
      expiredAt.setUTCHours(0, 0, 0, 0); // Start of the day in UTC
    } else {
      // Default: 2 days expiration for other bonus types
      expiredAt = new Date();
      expiredAt.setDate(expiredAt.getDate() + 2);
    }

    // Create bonus transaction
    const bonusTransaction = this.bonusTransactionRepository.create({
      userId,
      amount,
      bonusType,
      status: BonusTransactionStatusEnum.PENDING,
      description: `${bonusType} bonus for period ${periodKey}`,
      metadata: { periodKey },
      expiredAt,
    });

    try {
      await this.bonusTransactionRepository.save(bonusTransaction);

      // Create notification for the new bonus (skip for weekly and monthly bonuses)
      if (bonusType !== BonusTypeEnum.WEEKLY_AWARD && bonusType !== BonusTypeEnum.MONTHLY_AWARD) {
        await this.bonusNotificationService.createBonusNotification(bonusTransaction);
      }

      this.logger.log(`Bonus created: ${amount} cents for user ${userId}`);
    } catch (error: any) {
      // Gracefully swallow duplicate-period insertions (unique index enforcement)
      const isDuplicate = typeof error?.code === 'string' && error.code === '23505';
      if (isDuplicate) {
        this.logger.warn(
          `Duplicate bonus detected by DB for user ${userId}, type ${bonusType}, period ${periodKey} (unique index)`,
        );
        return;
      }
      throw error;
    }
  }

  // Helper methods
  private async getUsersWithVipTiers(statuses: IUserVipStatus[]): Promise<IUserWithVipTier[]> {
    const users: IUserWithVipTier[] = [];

    for (const status of statuses) {
      const tier = await this.vipTierService.findTierByLevel(status.currentVipLevel);
      if (tier && tier.level > 0) {
        // Only users with VIP levels
        users.push({
          id: status.userId,
          tier,
        });
      }
    }

    return users;
  }

  private async getBalanceStats(
    userIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<IBalanceStats[]> {
    // ✅ FIXED: Use real daily data instead of cumulative
    this.logger.log(
      `Getting daily balance stats for ${userIds.length} users from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const dailyStats = await this.balanceService.getDailyRakebackStats(userIds, startDate, endDate);

    return dailyStats.map((stat) => ({
      userId: stat.userId,
      bets: stat.bets, // daily bets in cents
      wins: stat.wins, // daily wins in cents
      refunds: stat.refunds, // daily refunds in cents
      effectiveEdgeCents: stat.effectiveEdgeCents, // Add effective edge
    }));
  }

  // Enhanced calculation methods with percentage support
  // Daily claim removed

  private calculateWeeklyBonus(
    tier: IVipTier,
    userBets?: string,
    userWins?: string,
    userRefunds?: string,
    effectiveEdgeCents?: string,
  ): string | null {
    if (!userBets || !userRefunds || !userWins || !effectiveEdgeCents) return null;

    const weeklyPercentage = tier.weeklyBonusPercentage
      ? parseFloat(tier.weeklyBonusPercentage) / 100
      : 0;

    if (weeklyPercentage === 0) return null;

    const effectiveEdge = parseFloat(effectiveEdgeCents);
    const wagerBonus = effectiveEdge * 0.05; // 5% of effective edge (in cents)

    const netWager = Math.max(0, parseFloat(userBets) - parseFloat(userRefunds));
    const netLoss = Math.max(0, netWager - parseFloat(userWins));
    const lossBonus = netLoss * 0.05; // 5% of net loss

    return Math.round(wagerBonus + lossBonus).toString();
  }

  private calculateMonthlyBonus(
    tier: IVipTier,
    userBets?: string,
    userWins?: string,
    userRefunds?: string,
    effectiveEdgeCents?: string,
  ): string | null {
    if (!userBets || !userRefunds || !userWins || !effectiveEdgeCents) return null;

    const monthlyPercentage = tier.monthlyBonusPercentage
      ? parseFloat(tier.monthlyBonusPercentage) / 100
      : 0;

    if (monthlyPercentage === 0) return null;

    const effectiveEdge = parseFloat(effectiveEdgeCents);
    const wagerBonus = effectiveEdge * 0.05; // capped at 5%

    const netWager = Math.max(0, parseFloat(userBets) - parseFloat(userRefunds));
    const netLoss = Math.max(0, netWager - parseFloat(userWins));
    const lossBonus = netLoss * monthlyPercentage;

    return Math.round(wagerBonus + lossBonus).toString();
  }

  // BullMQ job processor - handles different job types
  async process(job: Job<IBonusJobData>): Promise<IBonusJobResult> {
    try {
      switch (job.name) {
        case 'scheduleDailyBonuses':
        case 'schedule-daily-bonuses': // Legacy compatibility
          await this.scheduleDailyBonuses();
          break;
        case 'scheduleDailyBonusesTestMode':
          await this.scheduleDailyBonusesTestMode();
          break;
        case 'scheduleWeeklyBonuses':
        case 'schedule-weekly-bonuses': // Legacy compatibility
          await this.scheduleWeeklyBonuses();
          break;
        case 'scheduleMonthlyBonuses':
        case 'schedule-monthly-bonuses': // Legacy compatibility
          await this.scheduleMonthlyBonuses();
          break;
        case 'scheduleWeeklyBonusesTestMode':
          await this.scheduleWeeklyBonusesTestMode();
          break;
        case 'scheduleMonthlyBonusesTestMode':
          await this.scheduleMonthlyBonusesTestMode();
          break;
        case 'expireBonuses':
        case 'expire-bonuses': // Legacy compatibility
          await this.expireBonuses();
          break;
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }

      return {
        processed: 0,
        failed: 0,
        totalBonus: '0',
      };
    } catch (error) {
      this.logger.error(`Job ${job.name} failed:`, error);
      throw error;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<IBonusJobData>, result: IBonusJobResult) {
    this.logger.log(`Job ${job.id} completed successfully`, {
      jobType: job.data.type,
      result,
      duration: Date.now() - job.processedOn!,
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<IBonusJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed`, {
      jobType: job.data.type,
      error: error.message,
      attemptsMade: job.attemptsMade,
      stack: error.stack,
    });
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} stalled`);
  }
}
