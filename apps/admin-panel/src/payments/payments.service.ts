import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApproveWithdrawRequestDto } from './dto/approve-withdraw-request.dto';
import { CreateAssetDto, AssetStatusEnum as CreateAssetStatusEnum } from './dto/create-asset.dto';
import { CurrencyRatesResponseDto } from './dto/currency-rates-response.dto';
import { GetWithdrawRequestsDto, WithdrawRequestStatus } from './dto/get-withdraw-requests.dto';
import { RejectWithdrawRequestDto } from './dto/reject-withdraw-request.dto';
import { AssetStatusEnum, UpdateAssetStatusDto } from './dto/update-asset-status.dto';
import { UserStatisticsDto } from './dto/user-statistics.dto';

// Define interface for BalanceStatisticEntity since we can't import it directly
interface IBalanceStatistic {
  userId: string;
  deps: string;
  withs: string;
  bets: string;
  wins: string;
  refunds: string;
}

export interface IAssetResponse {
  symbol: string;
  status: AssetStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWithdrawRequestResponse {
  id: string;
  userId: string;
  user?: {
    id: string;
    email?: string;
  };
  asset: string;
  amount: string;
  toAddress: string;
  status: WithdrawRequestStatus;
  approvedBy?: string;
  approvedAt?: Date;
  txId?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWithdrawRequestsResult {
  requests: IWithdrawRequestResponse[];
  total: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async getAllAssets(): Promise<IAssetResponse[]> {
    const assets = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets ORDER BY symbol ASC',
    );
    return assets;
  }

  async createAsset(dto: CreateAssetDto): Promise<IAssetResponse> {
    // Check if asset already exists
    const existing = await this.dataSource.query(
      'SELECT symbol FROM payments.assets WHERE symbol = $1',
      [dto.symbol],
    );

    if (existing && existing.length > 0) {
      throw new ConflictException(`Asset with symbol '${dto.symbol}' already exists`);
    }

    const status = dto.status || CreateAssetStatusEnum.ACTIVE;

    await this.dataSource.query(
      'INSERT INTO payments.assets (symbol, status, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
      [dto.symbol, status],
    );

    const result = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets WHERE symbol = $1',
      [dto.symbol],
    );

    return result[0];
  }

  async getCurrencyRates(): Promise<CurrencyRatesResponseDto> {
    // Get all latest rates from currency_rate_history table
    const ratesQuery = `
      SELECT DISTINCT ON (asset) asset, rate, "createdAt"
      FROM balance.currency_rate_history
      ORDER BY asset, "createdAt" DESC
    `;

    const ratesResult = await this.dataSource.query(ratesQuery);

    const rates: Record<string, number> = {};
    let lastUpdated = new Date(0); // Default to epoch

    for (const row of ratesResult) {
      rates[row.asset] = parseFloat(row.rate);
      const rowDate = new Date(row.createdAt);
      if (rowDate > lastUpdated) {
        lastUpdated = rowDate;
      }
    }

    return {
      rates,
      lastUpdated: lastUpdated.toISOString(),
    };
  }

  async getUserStatistics(userId: string): Promise<UserStatisticsDto> {
    // Get user registration date and last activity (placeholder for now)
    const usersSchema = this.configService.get<string>('database.schemas.users') || 'users';
    const userQuery = `
      SELECT "createdAt", "updatedAt"
      FROM ${usersSchema}.users
      WHERE id = $1
    `;

    let userResult;
    try {
      userResult = await this.dataSource.query(userQuery, [userId]);
    } catch {
      // If users table doesn't exist or we can't access it, use placeholder data
      userResult = [
        {
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
    }

    // Get deposit statistics
    const depositStatsQuery = `
      SELECT 
        COUNT(*) as total_deposits,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
      FROM payments.transactions
      WHERE "userId" = $1 AND type = 'DEPOSIT' AND status = 'COMPLETED'
    `;

    // Get withdrawal statistics
    const withdrawalStatsQuery = `
      SELECT 
        COUNT(*) as total_withdrawals,
        COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total_amount
      FROM payments.withdraw_requests
      WHERE "userId" = $1 AND status IN ('APPROVED', 'SENT')
    `;

    // Get pending withdrawals
    const pendingWithdrawalsQuery = `
      SELECT COUNT(*) as pending_count
      FROM payments.withdraw_requests
      WHERE "userId" = $1 AND status = 'PENDING'
    `;

    const [depositStats, withdrawalStats, pendingStats] = await Promise.all([
      this.dataSource.query(depositStatsQuery, [userId]),
      this.dataSource.query(withdrawalStatsQuery, [userId]),
      this.dataSource.query(pendingWithdrawalsQuery, [userId]),
    ]);

    // For now, we'll use placeholder USD amounts since we need to convert each transaction
    // In a real implementation, you'd convert each transaction amount to USD using historical rates

    return {
      userId,
      totalDeposits: parseInt(depositStats[0]?.total_deposits || '0'),
      totalDepositAmountUsd: 0, // Placeholder - would need historical rate conversion
      totalWithdrawals: parseInt(withdrawalStats[0]?.total_withdrawals || '0'),
      totalWithdrawalAmountUsd: 0, // Placeholder - would need historical rate conversion
      pendingWithdrawals: parseInt(pendingStats[0]?.pending_count || '0'),
      registrationDate: userResult[0]?.createdAt?.toISOString() || new Date().toISOString(),
      lastActivity: userResult[0]?.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  async updateAssetStatus(symbol: string, dto: UpdateAssetStatusDto): Promise<IAssetResponse> {
    const result = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets WHERE symbol = $1',
      [symbol],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`Asset with symbol '${symbol}' not found`);
    }

    await this.dataSource.query(
      'UPDATE payments.assets SET status = $1, "updatedAt" = NOW() WHERE symbol = $2',
      [dto.status, symbol],
    );

    const updatedResult = await this.dataSource.query(
      'SELECT symbol, status, "createdAt", "updatedAt" FROM payments.assets WHERE symbol = $1',
      [symbol],
    );

    return updatedResult[0];
  }

  async getWithdrawRequests(filters: GetWithdrawRequestsDto): Promise<IWithdrawRequestsResult> {
    let query = `
      SELECT 
        wr.id, wr."userId", wr.asset, wr.amount, wr."toAddress", 
        wr.status, wr."approvedBy", wr."approvedAt", wr."txId", 
        wr."failureReason", wr."createdAt", wr."updatedAt"
      FROM payments.withdraw_requests wr
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND wr.status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.userId) {
      query += ` AND wr."userId" = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.asset) {
      query += ` AND UPPER(wr.asset) = $${paramIndex}`;
      params.push(filters.asset.toUpperCase());
      paramIndex++;
    }

    // Count total with same filters
    let countQuery = `
      SELECT COUNT(*) as count
      FROM payments.withdraw_requests wr
      WHERE 1=1
    `;

    const countParams: any[] = [];
    let countParamIndex = 1;

    if (filters.status) {
      countQuery += ` AND wr.status = $${countParamIndex}`;
      countParams.push(filters.status);
      countParamIndex++;
    }

    if (filters.userId) {
      countQuery += ` AND wr."userId" = $${countParamIndex}`;
      countParams.push(filters.userId);
      countParamIndex++;
    }

    if (filters.asset) {
      countQuery += ` AND UPPER(wr.asset) = $${countParamIndex}`;
      countParams.push(filters.asset.toUpperCase());
      countParamIndex++;
    }

    const countResult = await this.dataSource.query(countQuery, countParams);
    const total = countResult && countResult[0] ? parseInt(countResult[0].count) : 0;

    // Add pagination
    query += ` ORDER BY wr."createdAt" DESC`;
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const requests = await this.dataSource.query(query, params);

    // Transform the flat result to nested structure
    const transformedRequests = requests.map((req: any) => ({
      id: req.id,
      userId: req.userId,
      user: {
        id: req.userId,
        email: undefined, // Will be filled later when we have access to users table
      },
      asset: req.asset,
      amount: req.amount,
      toAddress: req.toAddress,
      status: req.status,
      approvedBy: req.approvedBy,
      approvedAt: req.approvedAt,
      txId: req.txId,
      failureReason: req.failureReason,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));

    return {
      requests: transformedRequests,
      total,
    };
  }

  async approveWithdrawRequest(
    id: string,
    dto: ApproveWithdrawRequestDto,
    adminId: string,
  ): Promise<IWithdrawRequestResponse> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      throw new Error('Backend URL or admin secret is not configured');
    }

    const payload = {
      comment: dto.comment,
      adminId,
    };

    const response = await fetch(
      `${backendUrl}/v1/payments/admin/withdraw-requests/${id}/approve`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': adminApiSecret,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message?.message ||
        errorData.message ||
        errorData.error ||
        JSON.stringify(errorData) ||
        'Unknown error';
      throw new Error(`Backend API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

    // Map backend response to admin panel format
    const request = data.request;
    return {
      id: request.id,
      userId: request.userId,
      user: {
        id: request.userId,
        email: undefined,
      },
      asset: request.asset,
      amount: request.amount,
      toAddress: request.toAddress,
      status: request.status,
      approvedBy: request.approvedBy,
      approvedAt: request.approvedAt ? new Date(request.approvedAt) : undefined,
      txId: request.txId,
      failureReason: request.failureReason,
      createdAt: new Date(request.createdAt),
      updatedAt: new Date(request.updatedAt),
    };
  }

  async rejectWithdrawRequest(
    id: string,
    dto: RejectWithdrawRequestDto,
  ): Promise<IWithdrawRequestResponse> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      throw new Error('Backend URL or admin secret is not configured');
    }

    const payload = {
      reason: dto.reason,
    };

    const response = await fetch(`${backendUrl}/v1/payments/admin/withdraw-requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simulator-secret': adminApiSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message?.message ||
        errorData.message ||
        errorData.error ||
        JSON.stringify(errorData) ||
        'Unknown error';
      throw new Error(`Backend API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

    // Map backend response to admin panel format
    const request = data.request;
    return {
      id: request.id,
      userId: request.userId,
      user: {
        id: request.userId,
        email: undefined,
      },
      asset: request.asset,
      amount: request.amount,
      toAddress: request.toAddress,
      status: request.status,
      approvedBy: request.approvedBy,
      approvedAt: request.approvedAt ? new Date(request.approvedAt) : undefined,
      txId: request.txId,
      failureReason: request.failureReason,
      createdAt: new Date(request.createdAt),
      updatedAt: new Date(request.updatedAt),
    };
  }

  async getUserBalanceStatistics(userId: string): Promise<IBalanceStatistic> {
    const result = await this.dataSource.query(
      `SELECT * FROM balance.balance_statistics WHERE "userId" = $1`,
      [userId],
    );

    if (result.length === 0) {
      // Return default statistics if none exist
      return {
        userId,
        deps: '0',
        withs: '0',
        bets: '0',
        wins: '0',
        refunds: '0',
      };
    }

    const stats = result[0];
    return {
      userId: stats.userId,
      deps: this.fromCentsToUsd(stats.deps || '0'),
      withs: this.fromCentsToUsd(stats.withs || '0'),
      bets: this.fromCentsToUsd(stats.bets || '0'),
      wins: this.fromCentsToUsd(stats.wins || '0'),
      refunds: this.fromCentsToUsd(stats.refunds || '0'),
    };
  }

  private fromCentsToUsd(cents: string): string {
    return (parseFloat(cents || '0') / 100).toFixed(2);
  }
}
