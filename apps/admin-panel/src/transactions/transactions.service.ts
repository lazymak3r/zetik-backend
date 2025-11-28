import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CurrencyRateHistoryEntity,
  TransactionEntity,
  TransactionStatusEnum,
  TransactionTypeEnum,
  UserEntity,
  WithdrawRequestEntity,
  WithdrawStatusEnum,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import {
  TransactionsResponseDto,
  TransactionSummaryDto,
  WithdrawRequestDto,
} from './dto/transaction.dto';

@Injectable()
export class TransactionsService {
  private rateCache = new Map<string, number>();
  private cacheTimestamp: Date | null = null;
  private readonly CACHE_TTL_HOURS = 1;

  private readonly fallbackRates: Record<string, number> = {
    BTC: 103000,
    ETH: 3200,
    USDT: 1,
    USDC: 1,
    LTC: 180,
    DOGE: 0.08,
    TRX: 0.1,
    XRP: 0.6,
    SOL: 100,
  };

  constructor(
    @InjectRepository(TransactionEntity)
    private transactionRepository: Repository<TransactionEntity>,
    @InjectRepository(WithdrawRequestEntity)
    private withdrawRequestRepository: Repository<WithdrawRequestEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(CurrencyRateHistoryEntity)
    private currencyRateRepository: Repository<CurrencyRateHistoryEntity>,
  ) {
    // Initialize cache in background to avoid blocking startup
    setTimeout(() => {
      void this.initializeCache();
    }, 1000);
  }

  async getTransactions(
    page: number = 1,
    limit: number = 20,
    type?: string,
    status?: string,
    userId?: string,
    asset?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<TransactionsResponseDto> {
    const queryBuilder = this.transactionRepository
      .createQueryBuilder('transaction')
      .orderBy('transaction.createdAt', 'DESC');

    // Filters
    if (type) {
      queryBuilder.andWhere('transaction.type = :type', { type });
    }
    if (status) {
      queryBuilder.andWhere('transaction.status = :status', { status });
    }
    if (userId) {
      queryBuilder.andWhere('transaction.userId = :userId', { userId });
    }
    if (asset) {
      queryBuilder.andWhere('transaction.asset = :asset', { asset });
    }
    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    const [transactions, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Get summary statistics
    const summary = await this.getTransactionsSummary();

    const items = transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      userId: transaction.userId || '',
      userEmail: transaction.userId ? 'user@example.com' : '', // TODO: get actual email
      amount: transaction.amount,
      asset: transaction.asset,
      amountUSD: this.calculateUsdValue(transaction.amount, transaction.asset),
      status: transaction.status,
      txHash: undefined, // TODO: get from fireblocks
      fromAddress: undefined,
      toAddress: transaction.address,
      createdAt: transaction.createdAt,
      completedAt:
        transaction.status === TransactionStatusEnum.COMPLETED ? transaction.updatedAt : undefined,
    }));

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      summary,
    };
  }

  async getTransactionsSummary(): Promise<TransactionSummaryDto> {
    // Get completed deposits and convert each to USD
    const completedDeposits = await this.transactionRepository.find({
      where: {
        type: TransactionTypeEnum.DEPOSIT,
        status: TransactionStatusEnum.COMPLETED,
      },
    });

    const totalDepositsUSD = completedDeposits.reduce((sum, transaction) => {
      const usdValue = parseFloat(this.calculateUsdValue(transaction.amount, transaction.asset));
      return sum + usdValue;
    }, 0);

    // Get completed withdrawals and convert each to USD
    const completedWithdrawals = await this.transactionRepository.find({
      where: {
        type: TransactionTypeEnum.WITHDRAWAL,
        status: TransactionStatusEnum.COMPLETED,
      },
    });

    const totalWithdrawalsUSD = completedWithdrawals.reduce((sum, transaction) => {
      const usdValue = parseFloat(this.calculateUsdValue(transaction.amount, transaction.asset));
      return sum + usdValue;
    }, 0);

    // Get pending withdrawals
    const pendingWithdrawals = await this.withdrawRequestRepository
      .createQueryBuilder('withdraw')
      .where('withdraw.status = :status', { status: WithdrawStatusEnum.PENDING })
      .getMany();

    const pendingCount = pendingWithdrawals.length;
    const pendingValue = pendingWithdrawals.reduce((sum, withdraw) => {
      const usdValue = parseFloat(this.calculateUsdValue(withdraw.amount, withdraw.asset));
      return sum + usdValue;
    }, 0);

    return {
      totalDeposits: this.formatUsdValue(totalDepositsUSD),
      totalWithdrawals: this.formatUsdValue(totalWithdrawalsUSD),
      pendingCount,
      pendingValue: this.formatUsdValue(pendingValue),
    };
  }

  async getPendingWithdrawals(): Promise<WithdrawRequestDto[]> {
    const withdrawals = await this.withdrawRequestRepository
      .createQueryBuilder('withdraw')
      .where('withdraw.status = :status', { status: WithdrawStatusEnum.PENDING })
      .orderBy('withdraw.createdAt', 'DESC')
      .getMany();

    // Get unique user IDs and fetch user data
    const userIds = [...new Set(withdrawals.map((withdrawal) => withdrawal.userId))];
    const users = await this.userRepository.findByIds(userIds);
    const userMap = new Map(users.map((user) => [user.id, user]));

    return withdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      userId: withdrawal.userId,
      userEmail: this.getUserEmail(userMap.get(withdrawal.userId)) || 'unknown@example.com',
      asset: withdrawal.asset,
      amount: withdrawal.amount,
      amountUSD: this.calculateUsdValue(withdrawal.amount, withdrawal.asset),
      toAddress: withdrawal.toAddress,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      processedAt: withdrawal.approvedAt,
      processedBy: withdrawal.approvedBy,
      txHash: withdrawal.txId,
      rejectReason: withdrawal.failureReason,
      userDetails: {
        totalDeposits: '0', // TODO: calculate from transactions
        totalWithdrawals: '0', // TODO: calculate from transactions
        currentBalance: '0', // TODO: get from balance service
        accountAge: this.calculateAccountAge(userMap.get(withdrawal.userId)?.createdAt),
        isVerified: false, // TODO: get verification status
      },
    }));
  }

  private async initializeCache(): Promise<void> {
    try {
      await this.updateCacheFromDatabase();
    } catch (error) {
      console.error('Failed to initialize cache:', error);
    }
  }

  private isCacheExpired(): boolean {
    if (!this.cacheTimestamp) {
      return true;
    }
    const now = new Date();
    const hoursDiff = (now.getTime() - this.cacheTimestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff >= this.CACHE_TTL_HOURS;
  }

  private async updateCacheFromDatabase(): Promise<void> {
    try {
      const rates = await this.getAllLatestRates();

      if (rates && Object.keys(rates).length > 0) {
        this.rateCache = new Map(Object.entries(rates));
        this.cacheTimestamp = new Date();
      }
    } catch (error) {
      console.error('Failed to update cache from database:', error);
    }
  }

  private async getAllLatestRates(): Promise<Record<string, number>> {
    const rates: Record<string, number> = {};
    const assets = Object.keys(this.fallbackRates);

    for (const asset of assets) {
      try {
        const latestRate = await this.currencyRateRepository.findOne({
          where: { asset: asset as any },
          order: { createdAt: 'DESC' },
        });

        if (latestRate && latestRate.rate) {
          rates[asset] = parseFloat(latestRate.rate);
        }
      } catch (error) {
        console.error(`Failed to get rate for ${asset}:`, error);
      }
    }

    return rates;
  }

  private getValidRate(asset: string): number {
    if (this.isCacheExpired()) {
      // Don't await here to avoid blocking, update in background
      this.updateCacheFromDatabase().catch(console.error);
    }

    const cachedRate = this.rateCache.get(asset);
    if (cachedRate && cachedRate > 0) {
      return cachedRate;
    }

    return this.fallbackRates[asset] || 1;
  }

  private calculateUsdValue(amount: string, asset: string): string {
    const rate = this.getValidRate(asset);
    const usdValue = parseFloat(amount) * rate;
    return usdValue.toFixed(2);
  }

  private formatUsdValue(value: number | string): string {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toFixed(2);
  }

  private calculateAccountAge(createdAt?: Date): number {
    if (!createdAt) return 0;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdAt.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getUserEmail(user?: any): string | null {
    if (!user) return null;

    // Check if registration data contains email
    const registrationData = user.registrationData;
    if (registrationData?.email) {
      return registrationData.email;
    }

    return null;
  }
}
