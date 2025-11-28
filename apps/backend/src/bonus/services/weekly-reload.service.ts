import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  BonusTransactionEntity,
  BonusTransactionStatusEnum,
  BonusTypeEnum,
} from '@zetik/shared-entities';
import { DataSource, MoreThan } from 'typeorm';
import { BalanceService } from '../../balance/balance.service';
import { LockTTL } from '../../common/constants/lock-ttl.constants';
import { LockAcquisitionException } from '../../common/exceptions/lock-acquisition.exception';
import { DistributedLockService } from '../../common/services/distributed-lock.service';
import { LockKeyBuilder } from '../../common/utils/lock-key-builder';
import { UserVipStatusService } from './user-vip-status.service';
import { VipTierService } from './vip-tier.service';

interface IVipTier {
  level: number;
  name: string;
  weeklyReloadDailyMinCents?: string;
  weeklyReloadProfitablePercentage?: string;
  weeklyReloadLosingPercentage?: string;
}

export interface IActivateWeeklyReloadResponse {
  success: boolean;
  message: string;
  bonusesCreated: number;
  totalWeeklyAmount: number; // in cents
  dailyAmount: number; // in cents
  expirationDate: Date;
  bonusDetails: Array<{
    bonusId: string;
    amount: number; // in cents
    activateAt: string;
    expiredAt: string;
  }>;
}

@Injectable()
export class WeeklyReloadService {
  private readonly logger = new Logger(WeeklyReloadService.name);

  /**
   * Apply minimum daily amount validation and enforcement
   */
  private applyMinimumDailyAmount(
    dailyAmount: number,
    vipTier: IVipTier,
    vipLevel: number,
  ): number {
    // Check if minimum daily amount is configured for this VIP tier
    if (!vipTier.weeklyReloadDailyMinCents) {
      throw new BadRequestException(
        `Weekly reload is not available for VIP tier ${vipLevel}. Minimum daily amount is not configured.`,
      );
    }

    const weeklyReloadDailyMinCents = parseFloat(vipTier.weeklyReloadDailyMinCents);

    // Validate the minimum amount value
    if (isNaN(weeklyReloadDailyMinCents) || weeklyReloadDailyMinCents < 0) {
      throw new BadRequestException(
        `Invalid minimum daily amount configuration for VIP tier ${vipLevel}`,
      );
    }

    if (dailyAmount < weeklyReloadDailyMinCents) {
      this.logger.log(
        `Daily amount ${dailyAmount} is below minimum ${weeklyReloadDailyMinCents} for VIP tier ${vipLevel}. Using minimum.`,
      );
      return Math.round(weeklyReloadDailyMinCents);
    }

    return dailyAmount;
  }

  constructor(
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly vipTierService: VipTierService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly distributedLockService: DistributedLockService,
  ) {}

  async checkActiveWeeklyReload(
    userId: string,
  ): Promise<{ hasActive: boolean; activeBonuses: number; expirationDate?: Date }> {
    const now = new Date();
    const activeBonuses = await this.dataSource.getRepository(BonusTransactionEntity).count({
      where: {
        userId,
        bonusType: BonusTypeEnum.WEEKLY_RELOAD,
        status: BonusTransactionStatusEnum.PENDING,
        expiredAt: MoreThan(now),
      },
    });

    if (activeBonuses > 0) {
      const latestBonus = await this.dataSource.getRepository(BonusTransactionEntity).findOne({
        where: {
          userId,
          bonusType: BonusTypeEnum.WEEKLY_RELOAD,
          status: BonusTransactionStatusEnum.PENDING,
          expiredAt: MoreThan(now),
        },
        order: { expiredAt: 'DESC' },
      });
      return { hasActive: true, activeBonuses, expirationDate: latestBonus?.expiredAt };
    }
    return { hasActive: false, activeBonuses: 0 };
  }

  /**
   * Activate weekly reload bonus for a user
   *
   * Race Condition Protection:
   * - Uses distributed lock to prevent concurrent activation across multiple instances
   * - Lock resource: bonus:reload:${userId}
   * - Lock TTL: 10000ms
   * - Prevents check-then-act race condition for hasActive check
   */
  async activateWeeklyReload(
    userId: string,
    adminId: string,
  ): Promise<IActivateWeeklyReloadResponse> {
    // Acquire distributed lock to prevent concurrent weekly reload activation
    const lockResource = LockKeyBuilder.bonusReload(userId);

    try {
      return await this.distributedLockService.withLock(
        lockResource,
        LockTTL.STANDARD_OPERATION, // Bonus operation with DB updates
        async () => {
          const queryRunner = this.dataSource.createQueryRunner();
          await queryRunner.connect();
          await queryRunner.startTransaction();

          try {
            const { hasActive } = await this.checkActiveWeeklyReload(userId);
            if (hasActive) {
              throw new BadRequestException('User already has an active weekly reload program.');
            }

            const now = new Date();
            // Use a wider range to catch all recent data regardless of timezone
            const sevenDaysAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday
            sevenDaysAgo.setHours(0, 0, 0, 0);
            const endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
            endDate.setHours(23, 59, 59, 999);

            this.logger.log(
              `Fetching stats for period: ${sevenDaysAgo.toISOString()} to ${endDate.toISOString()}`,
            );
            const stats = await this.balanceService.getDailyRakebackStats(
              [userId],
              sevenDaysAgo,
              endDate,
            );

            this.logger.log(`getDailyRakebackStats returned ${stats.length} users:`, stats);

            const userStats = stats[0];

            if (!userStats) {
              throw new BadRequestException(
                'No sufficient activity in the last 7 days to calculate weekly reload.',
              );
            }

            const vipStatus = await this.userVipStatusService.getUserVipStatus(userId);
            const vipLevel = vipStatus?.currentVipLevel || 0;
            const vipTier = await this.vipTierService.findTierByLevel(vipLevel);
            if (!vipTier) {
              throw new BadRequestException(`VIP tier ${vipLevel} not found`);
            }

            const effectiveEdge = parseFloat(userStats.effectiveEdgeCents || '0');
            const netWager = parseFloat(userStats.bets) - parseFloat(userStats.refunds);
            const netResult = netWager - parseFloat(userStats.wins);

            this.logger.log(`Weekly reload calculation debug for user ${userId}:`, {
              effectiveEdgeCents: effectiveEdge,
              effectiveEdgeDollars: effectiveEdge / 100, // Convert to dollars for clarity
              netWagerCents: netWager,
              netWagerDollars: netWager / 100,
              netResultCents: netResult,
              netResultDollars: netResult / 100,
              bets: userStats.bets,
              wins: userStats.wins,
              refunds: userStats.refunds,
              vipLevel: vipLevel,
              vipTier: {
                weeklyReloadLosingPercentage: vipTier.weeklyReloadLosingPercentage,
                weeklyReloadProfitablePercentage: vipTier.weeklyReloadProfitablePercentage,
              },
            });

            let weeklyReloadPercentage = 0;
            if (netResult > 0) {
              weeklyReloadPercentage = parseFloat(vipTier.weeklyReloadLosingPercentage || '0');
              this.logger.log(
                `User is losing, using losing percentage: ${weeklyReloadPercentage}%`,
              );
            } else {
              weeklyReloadPercentage = parseFloat(vipTier.weeklyReloadProfitablePercentage || '0');
              this.logger.log(
                `User is profitable, using profitable percentage: ${weeklyReloadPercentage}%`,
              );
            }

            if (weeklyReloadPercentage === 0) {
              throw new BadRequestException(
                'Weekly reload percentage not configured for user VIP tier.',
              );
            }

            // Financial calculation: all amounts in cents for precision
            const weeklyReloadAmount = Math.round(effectiveEdge * (weeklyReloadPercentage / 100));

            this.logger.log(`Weekly reload calculation result:`, {
              effectiveEdge: effectiveEdge / 100,
              weeklyReloadPercentage,
              weeklyReloadAmount: weeklyReloadAmount / 100,
            });

            if (weeklyReloadAmount <= 0) {
              throw new BadRequestException(
                `Weekly reload amount is ${weeklyReloadAmount / 100} dollars - check calculation`,
              );
            }

            let dailyAmount = Math.round(weeklyReloadAmount / 7);

            // Apply minimum daily amount validation and enforcement
            dailyAmount = this.applyMinimumDailyAmount(dailyAmount, vipTier, vipLevel);
            const activationBaseTime = new Date();

            const bonuses: BonusTransactionEntity[] = [];

            for (let day = 0; day < 7; day++) {
              // First day bonus can be claimed immediately, others with 24h intervals
              const activateAt =
                day === 0
                  ? new Date(activationBaseTime) // First day: immediately available
                  : new Date(activationBaseTime.getTime() + day * 24 * 60 * 60 * 1000); // Days 2-7: with intervals

              const expiredAt = new Date(
                activationBaseTime.getTime() + (day + 1) * 24 * 60 * 60 * 1000,
              );

              const bonus = queryRunner.manager.create(BonusTransactionEntity, {
                userId,
                bonusType: BonusTypeEnum.WEEKLY_RELOAD,
                amount: dailyAmount.toString(),
                status: BonusTransactionStatusEnum.PENDING,
                activateAt,
                expiredAt,
                description: `Daily Reload ${day + 1}/7 - Weekly Reload Program`,
                metadata: {
                  weeklyReloadProgram: true,
                  dayNumber: day + 1,
                  totalDays: 7,
                  activatedBy: adminId,
                  activatedAt: activationBaseTime.toISOString(),
                  activateAtFormatted: activateAt.toISOString().split('T')[0],
                  expiredAtFormatted: expiredAt.toISOString().split('T')[0],
                },
              });

              bonuses.push(bonus);
            }

            await queryRunner.manager.save(BonusTransactionEntity, bonuses);
            await queryRunner.commitTransaction();

            const lastBonusExpiration = bonuses[bonuses.length - 1].expiredAt!;

            this.logger.log(`Weekly reload activated for user ${userId}`, {
              userId,
              adminId,
              bonusesCreated: 7,
              totalAmount: weeklyReloadAmount,
              dailyAmount,
              firstActivation: bonuses[0].activateAt,
              lastExpiration: lastBonusExpiration,
            });

            return {
              success: true,
              message: 'Weekly reload activated successfully - 7 daily bonuses created',
              bonusesCreated: 7,
              totalWeeklyAmount: weeklyReloadAmount, // in cents
              dailyAmount: dailyAmount, // in cents
              expirationDate: lastBonusExpiration,
              bonusDetails: bonuses.map((bonus) => ({
                bonusId: bonus.id,
                amount: dailyAmount, // in cents
                activateAt: bonus.activateAt!.toISOString(),
                expiredAt: bonus.expiredAt!.toISOString(),
              })),
            };
          } catch (error) {
            await queryRunner.rollbackTransaction();
            this.logger.error(`Failed to activate weekly reload for user ${userId}:`, error);
            throw error;
          } finally {
            await queryRunner.release();
          }
        },
        {
          retryCount: 3,
          retryDelay: 200,
          retryJitter: 100,
        },
      );
    } catch (error) {
      if (error instanceof LockAcquisitionException) {
        this.logger.warn('Failed to acquire lock for weekly reload activation', {
          userId,
          adminId,
          lockResource,
        });
        throw new BadRequestException(
          'The system is currently busy. Please try again in a moment.',
        );
      }
      throw error;
    }
  }

  async calculateWeeklyReloadAmount(userId: string): Promise<{
    userId: string;
    totalWeeklyAmount: number;
    dailyAmount: number;
    vipLevel: number;
    appliedPercentage: number;
    effectiveEdge: number;
    netResult: number;
    isProfitable: boolean;
    periodAnalyzed: string;
  }> {
    // Check if user already has active Weekly Reload bonuses
    const activeReload = await this.checkActiveWeeklyReload(userId);
    if (activeReload.hasActive) {
      throw new BadRequestException(
        `User already has ${activeReload.activeBonuses} active Weekly Reload bonuses. Please wait until they expire before calculating new ones.`,
      );
    }

    // Calculate weekly reload amount based on last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);

    // Expand date range to ensure we capture all recent activity
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    yesterday.setHours(0, 0, 0, 0);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    tomorrow.setHours(23, 59, 59, 999);

    this.logger.log(`📊 Calculating weekly reload for user ${userId}`);
    this.logger.log(`📅 Date range: ${yesterday.toISOString()} to ${tomorrow.toISOString()}`);

    const stats = await this.balanceService.getDailyRakebackStats([userId], yesterday, tomorrow);
    const userStats = stats[0];

    if (!userStats) {
      throw new BadRequestException('No user activity found for weekly reload calculation');
    }

    // Calculate net result: wins + refunds - bets
    const betsCents = parseInt(userStats.bets) || 0;
    const winsCents = parseInt(userStats.wins) || 0;
    const refundsCents = parseInt(userStats.refunds) || 0;
    const netResultCents = winsCents + refundsCents - betsCents;

    this.logger.log(`📈 User stats:`, {
      effectiveEdgeCents: userStats.effectiveEdgeCents,
      bets: userStats.bets,
      wins: userStats.wins,
      refunds: userStats.refunds,
      netResultCents,
    });

    const effectiveEdgeCents = parseInt(userStats.effectiveEdgeCents) || 0;
    const isProfitable = netResultCents > 0;

    // Get user VIP level from VIP status table only
    const userVipStatus = await this.userVipStatusService.getUserVipStatus(userId);
    const vipLevel = userVipStatus?.currentVipLevel || 0;

    this.logger.log(`🎖️ User VIP level: ${vipLevel}`);

    // Get VIP tier percentages
    const vipTier = await this.vipTierService.findTierByLevel(vipLevel);
    if (!vipTier) {
      throw new BadRequestException(`VIP tier ${vipLevel} not found`);
    }

    const weeklyReloadProfitablePercentage = parseFloat(
      vipTier.weeklyReloadProfitablePercentage || '0',
    );
    const weeklyReloadLosingPercentage = parseFloat(vipTier.weeklyReloadLosingPercentage || '0');

    const weeklyReloadPercentage = isProfitable
      ? weeklyReloadProfitablePercentage
      : weeklyReloadLosingPercentage;

    this.logger.log(
      `💰 Weekly reload percentage: ${weeklyReloadPercentage}% (${isProfitable ? 'profitable' : 'losing'} player)`,
    );

    if (effectiveEdgeCents === 0) {
      throw new BadRequestException('User has no effective edge for weekly reload calculation');
    }

    const effectiveEdge = effectiveEdgeCents; // Keep in cents for calculation
    // Financial calculation: all amounts in cents for precision
    const weeklyReloadAmount = Math.round(effectiveEdge * (weeklyReloadPercentage / 100));
    let dailyAmount = Math.round(weeklyReloadAmount / 7);

    // Apply minimum daily amount validation and enforcement
    dailyAmount = this.applyMinimumDailyAmount(dailyAmount, vipTier, vipLevel);

    this.logger.log(`🎯 Calculation results:`, {
      effectiveEdgeCents,
      weeklyReloadPercentage,
      weeklyReloadAmount,
      dailyAmount,
    });

    return {
      userId,
      totalWeeklyAmount: weeklyReloadAmount, // Return in cents
      dailyAmount: dailyAmount, // Return in cents
      vipLevel,
      appliedPercentage: weeklyReloadPercentage,
      effectiveEdge: effectiveEdgeCents, // Return in cents
      netResult: netResultCents, // Return in cents
      isProfitable,
      // Display last 7 full days for the period, independent from the query window
      periodAnalyzed: `${sevenDaysAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
    };
  }
}
