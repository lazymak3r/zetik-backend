import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DailyGamblingStatsEntity, PlatformTypeEnum } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class DailyGamblingStatsService {
  constructor(
    @InjectRepository(DailyGamblingStatsEntity)
    private readonly dailyGamblingStatsRepository: Repository<DailyGamblingStatsEntity>,
  ) {}

  /**
   * Update daily gambling statistics for a user
   * @param userId User ID
   * @param platformType Platform type (sports, casino, or platform)
   * @param wagerAmount Amount wagered (positive number)
   * @param winAmount Amount won (positive number)
   * @returns Updated daily gambling statistics
   */
  async updateStats(
    userId: string,
    platformType: PlatformTypeEnum,
    wagerAmount: number,
    winAmount: number,
  ): Promise<DailyGamblingStatsEntity> {
    // Get today's date (YYYY-MM-DD)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create stats for today
    let stats = await this.dailyGamblingStatsRepository.findOne({
      where: {
        userId,
        date: today,
        platformType,
      },
    });

    if (!stats) {
      // Create new stats record
      stats = this.dailyGamblingStatsRepository.create({
        userId,
        date: today,
        platformType,
        wagerAmountCents: '0',
        winAmountCents: '0',
        lossAmountCents: '0',
        depositAmountCents: '0',
      });
    }

    // Update stats
    const currentWager = Number(stats.wagerAmountCents);
    const currentWin = Number(stats.winAmountCents);

    // Convert to cents (assuming input is in dollars)
    const wagerAmountCents = wagerAmount * 100;
    const winAmountCents = winAmount * 100;

    // Update totals
    const newWagerTotal = currentWager + wagerAmountCents;
    const newWinTotal = currentWin + winAmountCents;

    // Calculate loss (wager - win, if positive)
    const newLossTotal = Math.max(0, newWagerTotal - newWinTotal);

    // Update entity
    stats.wagerAmountCents = newWagerTotal.toString();
    stats.winAmountCents = newWinTotal.toString();
    stats.lossAmountCents = newLossTotal.toString();

    // Save updated stats
    return this.dailyGamblingStatsRepository.save(stats);
  }

  /**
   * Get total loss amount for a user within a given period
   * @param userId User ID
   * @param startDate Start date of the period
   * @param endDate End date of the period
   * @param platformType Optional platform type to filter by
   * @returns Total loss amount in the period
   */
  async getTotalLossAmount(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Ensure dates are set to start/end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build query
    const queryBuilder = this.dailyGamblingStatsRepository
      .createQueryBuilder('stats')
      .select('SUM(CAST(stats.lossAmountCents AS DECIMAL))', 'totalLoss')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });

    // Add platform type filter if provided
    if (platformType) {
      queryBuilder.andWhere('stats.platformType = :platformType', { platformType });
    }

    // Execute query
    const result = await queryBuilder.getRawOne<{ totalLoss: string }>();

    // Return result (convert from cents to dollars)
    return result?.totalLoss ? Number(result.totalLoss) / 100 : 0;
  }

  /**
   * Update daily deposit statistics for a user
   * @param userId User ID
   * @param platformType Platform type (sports, casino, or platform)
   * @param depositAmount Amount deposited (positive number)
   * @returns Updated daily gambling statistics
   */
  async updateDepositStats(
    userId: string,
    platformType: PlatformTypeEnum,
    depositAmount: number,
  ): Promise<DailyGamblingStatsEntity> {
    // Get today's date (YYYY-MM-DD)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find or create stats for today
    let stats = await this.dailyGamblingStatsRepository.findOne({
      where: {
        userId,
        date: today,
        platformType,
      },
    });

    if (!stats) {
      // Create new stats record
      stats = this.dailyGamblingStatsRepository.create({
        userId,
        date: today,
        platformType,
        wagerAmountCents: '0',
        winAmountCents: '0',
        lossAmountCents: '0',
        depositAmountCents: '0',
      });
    }

    // Update deposit stats
    const currentDeposit = Number(stats.depositAmountCents || '0');

    // Convert to cents (assuming input is in dollars)
    const depositAmountCents = depositAmount * 100;

    // Update total
    const newDepositTotal = currentDeposit + depositAmountCents;

    // Update entity
    stats.depositAmountCents = newDepositTotal.toString();

    // Save updated stats
    return this.dailyGamblingStatsRepository.save(stats);
  }

  /**
   * Get total deposit amount for a user within a given period
   * @param userId User ID
   * @param startDate Start date of the period
   * @param endDate End date of the period
   * @param platformType Optional platform type to filter by
   * @returns Total deposit amount in the period
   */
  async getTotalDepositAmount(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Ensure dates are set to start/end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build query
    const queryBuilder = this.dailyGamblingStatsRepository
      .createQueryBuilder('stats')
      .select('SUM(CAST(stats.depositAmountCents AS DECIMAL))', 'totalDeposit')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });

    // Add platform type filter if provided
    if (platformType) {
      queryBuilder.andWhere('stats.platformType = :platformType', { platformType });
    }

    // Execute query
    const result = await queryBuilder.getRawOne<{ totalDeposit: string }>();

    // Return result (convert from cents to dollars)
    return result?.totalDeposit ? Number(result.totalDeposit) / 100 : 0;
  }

  /**
   * Get total wager amount for a user within a given period
   * @param userId User ID
   * @param startDate Start date of the period
   * @param endDate End date of the period
   * @param platformType Optional platform type to filter by
   * @returns Total wager amount in cents (integer)
   */
  async getTotalWagersForPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<number> {
    // Ensure dates are set to start/end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build query
    const queryBuilder = this.dailyGamblingStatsRepository
      .createQueryBuilder('stats')
      .select('SUM(CAST(stats.wagerAmountCents AS DECIMAL))', 'totalWager')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });

    // Add platform type filter if provided
    if (platformType) {
      queryBuilder.andWhere('stats.platformType = :platformType', { platformType });
    }

    // Execute query
    const result = await queryBuilder.getRawOne<{ totalWager: string }>();

    // Return result in cents as integer (no conversion to dollars)
    return result?.totalWager ? Number(result.totalWager) : 0;
  }

  /**
   * Get daily gambling statistics for a user within a given period
   * @param userId User ID
   * @param startDate Start date of the period
   * @param endDate End date of the period
   * @param platformType Optional platform type to filter by
   * @returns Array of daily gambling statistics
   */
  async getStatsByPeriod(
    userId: string,
    startDate: Date,
    endDate: Date,
    platformType?: PlatformTypeEnum,
  ): Promise<DailyGamblingStatsEntity[]> {
    // Ensure dates are set to start/end of day
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build query
    const queryBuilder = this.dailyGamblingStatsRepository
      .createQueryBuilder('stats')
      .where('stats.userId = :userId', { userId })
      .andWhere('stats.date BETWEEN :startDate AND :endDate', {
        startDate: start,
        endDate: end,
      });

    // Add platform type filter if provided
    if (platformType) {
      queryBuilder.andWhere('stats.platformType = :platformType', { platformType });
    }

    // Execute query
    return queryBuilder.getMany();
  }
}
