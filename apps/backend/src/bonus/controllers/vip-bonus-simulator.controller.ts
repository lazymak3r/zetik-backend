import { Body, Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import {
  BalanceHistoryEntity,
  BalanceOperationEnum,
  BalanceStatisticEntity,
  BonusTransactionEntity,
} from '@zetik/shared-entities';
import { randomUUID } from 'crypto';
import { BalanceService } from '../../balance/balance.service';

import { CurrencyEnum } from '@zetik/common';

import {
  ResetUserStatsDto,
  ResetUserStatsResponseDto,
  SimulateGameSessionDto,
  SimulateGameSessionResponseDto,
  TriggerBonusResponseDto,
} from '../dto/vip-bonus-simulator.dto';
import { BonusNotificationService } from '../services/bonus-notification.service';
import { BonusSchedulerService } from '../services/bonus-scheduler.service';
import { UserVipStatusService } from '../services/user-vip-status.service';
import { VipTierService } from '../services/vip-tier.service';

@Controller('vip-bonus-simulator')
export class VipBonusSimulatorController {
  private readonly SIMULATOR_SECRET = process.env.VIP_SIMULATOR_SECRET || 'dev-secret-123';

  constructor(
    private readonly balanceService: BalanceService,
    private readonly bonusSchedulerService: BonusSchedulerService,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly vipTierService: VipTierService,
    private readonly bonusNotificationService: BonusNotificationService,
  ) {}

  private validateSecret(secret: string): void {
    if (secret !== this.SIMULATOR_SECRET) {
      throw new UnauthorizedException('Invalid simulator secret');
    }
  }

  // removed simulate-bet / simulate-win / simulate-bonus endpoints to keep simulator realistic

  @Post('simulate-game-session')
  async simulateGameSession(
    @Body() dto: SimulateGameSessionDto,
    @Headers('x-simulator-secret') secret: string,
  ): Promise<SimulateGameSessionResponseDto> {
    this.validateSecret(secret);

    const results: Array<{
      betAmount: string;
      winAmount: string;
      netResult: number;
    }> = [];

    for (const game of dto.games) {
      const betOperationId = randomUUID();

      // Simulate bet (betAmount in cents, pass as cents to fiat balance)
      const betAmountCents = game.betAmount;
      await this.balanceService.updateFiatBalance({
        userId: dto.userId,
        amount: betAmountCents,
        operationId: betOperationId,
        operation: BalanceOperationEnum.BET,
        currency: CurrencyEnum.USD,
        houseEdge: 1, // Add for simulation
      });

      // bet.confirmed event will be automatically emitted by BalanceService

      // Simulate win (if any)
      if (game.winAmount && parseInt(game.winAmount) > 0) {
        const winAmountCents = game.winAmount;
        await this.balanceService.updateFiatBalance({
          userId: dto.userId,
          amount: winAmountCents,
          operationId: randomUUID(),
          operation: BalanceOperationEnum.WIN,
          currency: CurrencyEnum.USD,
        });
      }

      results.push({
        betAmount: game.betAmount,
        winAmount: game.winAmount || '0',
        netResult: parseInt(game.winAmount || '0') - parseInt(game.betAmount),
      });
    }

    return {
      success: true,
      message: `Simulated ${dto.games.length} games`,
      games: results,
      totalBet: dto.games.reduce((sum, g) => sum + parseInt(g.betAmount), 0).toString(),
      totalWin: dto.games.reduce((sum, g) => sum + parseInt(g.winAmount || '0'), 0).toString(),
    };
  }

  @Post('trigger-daily-bonuses')
  async triggerDailyBonuses(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    return await this.bonusSchedulerService.triggerDailyBonuses();
  }

  @Post('trigger-weekly-bonuses')
  async triggerWeeklyBonuses(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    return await this.bonusSchedulerService.triggerWeeklyBonuses();
  }

  @Post('trigger-weekly-bonuses-test')
  async triggerWeeklyBonusesTest(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    // Use normal weekly trigger; test-mode removed
    return await this.bonusSchedulerService.triggerWeeklyBonuses();
  }

  @Post('trigger-monthly-bonuses')
  async triggerMonthlyBonuses(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    return await this.bonusSchedulerService.triggerMonthlyBonuses();
  }

  @Post('trigger-monthly-bonuses-test')
  async triggerMonthlyBonusesTest(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    // Use normal monthly trigger; test-mode removed
    return await this.bonusSchedulerService.triggerMonthlyBonuses();
  }

  @Post('force-bonus')
  async forceBonus(
    @Headers('x-simulator-secret') secret: string,
    @Body()
    body: {
      userId: string;
      type: 'RAKEBACK' | 'WEEKLY_AWARD' | 'MONTHLY_AWARD';
      netLossCents?: string; // optional override
    },
  ) {
    this.validateSecret(secret);

    const { userId, type, netLossCents } = body;
    if (!userId || !type) {
      throw new UnauthorizedException('userId and type are required');
    }

    const tier = await this.userVipStatusService.getUserVipStatus(userId).then(async (s) => {
      if (!s) return null;
      return this.vipTierService.findTierByLevel(s.currentVipLevel);
    });
    if (!tier) {
      throw new UnauthorizedException('Tier not found for user');
    }

    const pickPct = () => {
      if (type === 'RAKEBACK') return parseFloat(tier.rakebackPercentage || '0');
      if (type === 'WEEKLY_AWARD') return parseFloat(tier.weeklyBonusPercentage || '0');
      if (type === 'MONTHLY_AWARD') return parseFloat(tier.monthlyBonusPercentage || '0');
      return 0;
    };
    const pct = pickPct();
    const baseLoss = Math.max(0, parseInt(netLossCents || '100000')); // $100 default
    const amount = Math.round(baseLoss * (pct / 100));

    // Don't create bonus if amount is 0 or negative
    if (amount <= 0) {
      return {
        success: false,
        message: `Bonus amount is $${(amount / 100).toFixed(2)} (tier ${tier.name} has ${pct}% for ${type}). Need positive amount.`,
      };
    }

    const repo = this.balanceService['dataSource'].getRepository(BonusTransactionEntity);
    const entity = repo.create({
      userId,
      amount: amount.toString(),
      bonusType: type as any,
      status: 'PENDING' as any,
      metadata: { periodKey: `force-${type.toLowerCase()}-${Date.now()}` } as any,
      description: `Forced ${type} for testing`,
    });
    const saved = await repo.save(entity);

    // Create notification for the forced bonus
    await this.bonusNotificationService.createBonusNotification(saved);

    return { success: true, message: `Forced ${type} created`, jobId: saved.id };
  }

  @Post('calculate-bonus-with-today-data')
  async calculateBonusWithTodayData(
    @Headers('x-simulator-secret') secret: string,
    @Body() body: { userId: string; type: 'WEEKLY_AWARD' | 'MONTHLY_AWARD' },
  ): Promise<any> {
    this.validateSecret(secret);

    const { userId, type } = body;

    // Get user's VIP tier
    const tier = await this.userVipStatusService.getUserVipStatus(userId).then(async (s) => {
      if (!s) return null;
      return this.vipTierService.findTierByLevel(s.currentVipLevel);
    });
    if (!tier) {
      throw new UnauthorizedException('Tier not found for user');
    }

    // Get today's balance statistics
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);

    const stats = await this.balanceService.getDailyRakebackStats([userId], dayStart, dayEnd);
    const userStats = stats[0];

    if (!userStats) {
      return { success: false, message: 'No stats found for user today' };
    }

    // Calculate bonus using the correct formulas from bonus.md
    const effectiveEdge = parseFloat(userStats.effectiveEdgeCents || '0');
    const netWager = Math.max(0, parseFloat(userStats.bets) - parseFloat(userStats.refunds));
    const netLoss = Math.max(0, netWager - parseFloat(userStats.wins));

    const wagerBonus = effectiveEdge * 0.05; // 5% of effective edge
    let lossBonus = 0;

    if (type === 'WEEKLY_AWARD') {
      lossBonus = netLoss * 0.05; // 5% of net loss for weekly
    } else if (type === 'MONTHLY_AWARD') {
      const monthlyPct = parseFloat(tier.monthlyBonusPercentage || '0') / 100;
      lossBonus = netLoss * monthlyPct; // Monthly % of net loss
    }

    const totalBonus = Math.round(wagerBonus + lossBonus);

    // Create bonus transaction
    const repo = this.balanceService['dataSource'].getRepository(BonusTransactionEntity);
    const entity = repo.create({
      userId,
      amount: totalBonus.toString(),
      bonusType: type as any,
      status: 'PENDING' as any,
      metadata: {
        periodKey: `simulator-${type.toLowerCase()}-${Date.now()}`,
        calculation: {
          effectiveEdge,
          netLoss,
          wagerBonus,
          lossBonus,
          totalBonus,
        },
      } as any,
      description: `Simulator ${type} calculated from today's data`,
    });
    const saved = await repo.save(entity);

    return {
      success: true,
      message: `${type} calculated with today's data`,
      bonusId: saved.id,
      calculation: {
        effectiveEdge: effectiveEdge / 100, // Convert to dollars for display
        netLoss: netLoss / 100,
        wagerBonus: wagerBonus / 100,
        lossBonus: lossBonus / 100,
        totalBonus: totalBonus / 100,
      },
    };
  }

  // removed weekly-stats/monthly-stats helpers; we will trigger cron and validate via public endpoints

  @Post('trigger-bonus-expiration')
  async triggerBonusExpiration(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);
    return await this.bonusSchedulerService.triggerBonusExpiration();
  }

  @Post('trigger-daily-bonuses-test')
  async triggerDailyBonusesTest(
    @Headers('x-simulator-secret') secret: string,
  ): Promise<TriggerBonusResponseDto> {
    this.validateSecret(secret);

    // ✅ Use test mode to calculate bonuses from today's activity
    return this.bonusSchedulerService.triggerDailyBonusesTestMode();
  }

  @Post('reset-user-stats')
  async resetUserStats(
    @Body() dto: ResetUserStatsDto,
    @Headers('x-simulator-secret') secret: string,
  ): Promise<ResetUserStatsResponseDto> {
    this.validateSecret(secret);

    try {
      // Reset VIP status to level 0
      await this.userVipStatusService.resetUserVipStatus(dto.userId);

      // Reset balance history (delete all transactions for this user)
      const historyRepo = this.balanceService['dataSource'].getRepository(BalanceHistoryEntity);
      const historyDeleteResult = await historyRepo.delete({ userId: dto.userId });

      // Reset bonus transactions (delete all bonus transactions for this user)
      const bonusTransactionRepo =
        this.balanceService['dataSource'].getRepository(BonusTransactionEntity);
      const bonusDeleteResult = await bonusTransactionRepo.delete({ userId: dto.userId });

      // Reset balance statistics
      const statRepo = this.balanceService['dataSource'].getRepository(BalanceStatisticEntity);
      const updateResult = await statRepo.update(
        { userId: dto.userId },
        {
          bets: '0',
          wins: '0',
          refunds: '0',
          deps: '0',
          withs: '0',
        },
      );

      // Check if statistics were actually reset
      if (updateResult.affected === 0) {
        // If no existing stats, create new ones with zero values
        const newStats = statRepo.create({
          userId: dto.userId,
          bets: '0',
          wins: '0',
          refunds: '0',
          deps: '0',
          withs: '0',
        });
        await statRepo.save(newStats);
      }

      // Verify the reset by checking current values
      const vipStatus = await this.userVipStatusService.getUserVipStatus(dto.userId);
      const balanceStats = await statRepo.findOne({ where: { userId: dto.userId } });

      const vipReset = !vipStatus || vipStatus.currentVipLevel === 0;
      const balanceReset =
        balanceStats &&
        balanceStats.bets === '0' &&
        balanceStats.wins === '0' &&
        balanceStats.refunds === '0';

      if (vipReset && balanceReset) {
        return {
          success: true,
          message: `User ${dto.userId} statistics reset successfully. VIP level: 0, All balances: 0, History cleared: ${historyDeleteResult.affected || 0} records, Bonuses cleared: ${bonusDeleteResult.affected || 0} records`,
          details: {
            vipLevel: vipStatus?.currentVipLevel || 0,
            vipWager: vipStatus?.currentWager || '0',
            historyRecordsDeleted: historyDeleteResult.affected || 0,
            bonusTransactionsDeleted: bonusDeleteResult.affected || 0,
            balanceStats: balanceStats
              ? {
                  bets: balanceStats.bets,
                  wins: balanceStats.wins,
                  refunds: balanceStats.refunds,
                  deps: balanceStats.deps,
                  withs: balanceStats.withs,
                }
              : {
                  bets: '0',
                  wins: '0',
                  refunds: '0',
                  deps: '0',
                  withs: '0',
                },
          },
        };
      } else {
        return {
          success: false,
          message: `Partial reset for user ${dto.userId}. VIP reset: ${vipReset}, Balance reset: ${balanceReset}, History cleared: ${historyDeleteResult.affected || 0} records, Bonuses cleared: ${bonusDeleteResult.affected || 0} records`,
          details: {
            vipLevel: vipStatus?.currentVipLevel || 0,
            vipWager: vipStatus?.currentWager || '0',
            historyRecordsDeleted: historyDeleteResult.affected || 0,
            bonusTransactionsDeleted: bonusDeleteResult.affected || 0,
            balanceStats: balanceStats
              ? {
                  bets: balanceStats.bets,
                  wins: balanceStats.wins,
                  refunds: balanceStats.refunds,
                  deps: balanceStats.deps,
                  withs: balanceStats.withs,
                }
              : {
                  bets: '0',
                  wins: '0',
                  refunds: '0',
                  deps: '0',
                  withs: '0',
                },
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset user stats: ${(error as Error).message}`,
      };
    }
  }

  @Get('vip-tiers')
  async getVipTiers(@Headers('x-simulator-secret') secret: string) {
    this.validateSecret(secret);
    return this.vipTierService.findAllTiers();
  }

  @Get('balance-history')
  async getBonusBalanceHistory(
    @Headers('x-simulator-secret') secret: string,
    @Query('userId') userId: string,
    @Query('limit') limit: string = '10',
    @Query('operation') operation: string = 'BONUS',
  ) {
    this.validateSecret(secret);
    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
    // Use direct repository query to avoid any guard/auth coupling and ensure exact filtering
    const historyRepo = this.balanceService['dataSource'].getRepository(BalanceHistoryEntity);
    const [items, total] = await historyRepo.findAndCount({
      where: {
        userId,
        operation: (operation || 'BONUS') as any,
      },
      order: { createdAt: 'DESC' },
      take: parsedLimit,
      skip: 0,
    });
    return { items, total };
  }
}
