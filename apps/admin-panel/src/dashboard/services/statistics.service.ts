import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  CurrencyRateHistoryEntity,
  TransactionEntity,
  TransactionStatusEnum,
  TransactionTypeEnum,
  UserEntity,
  WithdrawRequestEntity,
  WithdrawStatusEnum,
} from '@zetik/shared-entities';
import { MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionRepo: Repository<TransactionEntity>,
    @InjectRepository(WithdrawRequestEntity)
    private readonly withdrawRequestRepo: Repository<WithdrawRequestEntity>,
    @InjectRepository(CurrencyRateHistoryEntity)
    private readonly currencyRateRepo: Repository<CurrencyRateHistoryEntity>,
  ) {}

  async getDashboardStatistics() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const totalUsers = await this.userRepo.count();

    const newUsers24h = await this.userRepo.count({
      where: {
        createdAt: MoreThanOrEqual(yesterday),
      },
    });

    const pendingWithdrawals = await this.withdrawRequestRepo.count({
      where: {
        status: WithdrawStatusEnum.PENDING,
      },
    });

    const deposits24hUSD = await this.calculateTransactionsInUSD(
      TransactionTypeEnum.DEPOSIT,
      yesterday,
    );

    const withdrawals24hUSD = await this.calculateTransactionsInUSD(
      TransactionTypeEnum.WITHDRAWAL,
      yesterday,
    );
    const totalDeposits = await this.calculateTransactionsInUSD(
      TransactionTypeEnum.DEPOSIT,
      new Date('2020-01-01'),
    );
    const totalWithdrawals = await this.calculateTransactionsInUSD(
      TransactionTypeEnum.WITHDRAWAL,
      new Date('2020-01-01'),
    );
    const systemBalance = totalDeposits - totalWithdrawals;

    return {
      totalUsers,
      newUsers24h,
      activeUsers24h: 0,
      totalDeposits24h: deposits24hUSD.toString(),
      totalWithdrawals24h: withdrawals24hUSD.toString(),
      totalBets24h: '0',
      totalWins24h: '0',
      houseEdge24h: '0',
      pendingWithdrawals,
      totalSystemBalance: systemBalance.toString(),
      gamesPlayed24h: 0,
      topGame24h: 'N/A',
    };
  }

  async getRevenueStatistics(days: number = 30) {
    // Limit max days to prevent abuse
    const maxDays = Math.min(Math.max(days, 1), 365);
    const data: any[] = [];
    const now = new Date();

    for (let i = 0; i < maxDays; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);

      const depositsUSD = await this.calculateTransactionsInUSD(TransactionTypeEnum.DEPOSIT, date);

      const withdrawalsUSD = await this.calculateTransactionsInUSD(
        TransactionTypeEnum.WITHDRAWAL,
        date,
      );

      const netRevenue = depositsUSD - withdrawalsUSD;

      data.push({
        date: date.toISOString().split('T')[0],
        deposits: depositsUSD.toString(),
        withdrawals: withdrawalsUSD.toString(),
        bets: '0',
        wins: '0',
        netRevenue: netRevenue.toString(),
        activeUsers: 0,
      });
    }

    return data.reverse();
  }

  private async calculateTransactionsInUSD(
    transactionType: TransactionTypeEnum,
    fromDate: Date,
  ): Promise<number> {
    const transactions = await this.transactionRepo.find({
      where: {
        type: transactionType,
        status: TransactionStatusEnum.COMPLETED,
        createdAt: MoreThanOrEqual(fromDate),
      },
      take: 10000, // Limit to prevent memory issues
    });

    let totalUSD = 0;

    for (const transaction of transactions) {
      const amount = parseFloat(transaction.amount);

      if (amount <= 0) continue;

      // USD stablecoins have rate = 1
      if (transaction.asset === AssetTypeEnum.USDT || transaction.asset === AssetTypeEnum.USDC) {
        totalUSD += amount;
      } else {
        // Get currency rate at transaction date or nearest available
        const rate = await this.getCurrencyRateAtDate(transaction.asset);

        if (rate) {
          totalUSD += amount * rate;
        }
      }
    }

    return totalUSD;
  }

  private async getCurrencyRateAtDate(asset: AssetTypeEnum): Promise<number | null> {
    // Find latest available rate
    const latestRate = await this.currencyRateRepo.findOne({
      where: { asset },
      order: { createdAt: 'DESC' },
    });

    if (latestRate) {
      return parseFloat(latestRate.rate);
    }

    return null;
  }
}
