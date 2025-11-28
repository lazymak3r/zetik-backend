import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { GameTypeEnum } from '@zetik/common';
import { AdminEntity, AdminRole, GAME_DISPLAY_NAMES, UserEntity } from '@zetik/shared-entities';
import { randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { PasswordUtil } from '../common/utils/password.util';
import { UserTransactionsResponseDto } from './dto/user-transactions-response.dto';

export interface IUserEntity {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  registrationStrategy: string;
  isBanned: boolean;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// New interface for frontend-expected user data
export interface IFrontendUserEntity {
  id: string;
  email: string;
  username?: string;
  isBanned: boolean;
  isPrivate: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  totalDeposits: string;
  totalWithdrawals: string;
  currentBalance: string;
  updatedAt: Date;
  mutedUntil?: Date | null;
  muteReason?: string | null;
  cookieConsentAcceptedAt?: Date | null;
  financials: {
    totalDeposits: string;
    totalWithdrawals: string;
    totalBets: string;
    totalWins: string;
    currentBalance: string;
    netProfit: string;
  };
  wallets: Array<{ asset: string; balance: string; address: string }>;
  gameStats: {
    totalGames: number;
    favoriteGame: string;
    winRate: number;
    averageBetSize: string;
  };
}

export interface IFindAllOptions {
  limit?: number;
  offset?: number;
  search?: string;
  banned?: boolean;
  strategy?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// New interface for paginated response
export interface IPaginatedUsersResponse {
  items: IFrontendUserEntity[];
  total: number;
  page: number;
  pages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private configService: ConfigService,
  ) {}

  async findAll(options: IFindAllOptions = {}): Promise<IPaginatedUsersResponse> {
    const {
      limit = 50,
      offset = 0,
      search,
      banned,
      strategy,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = options;

    // Build the base query with all necessary fields
    let baseQuery = `
      SELECT 
        u.id,
        COALESCE(
          u.email,
          u."registrationData"::json->>'email',
          CASE 
            WHEN u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
              THEN u."registrationData"::json->>'address'
            WHEN u."registrationStrategy" = 'STEAM' 
              THEN COALESCE(
                u."registrationData"::json->>'steamId',
                u."registrationData"::json->>'personaName'
              )
            ELSE u.username
          END
        ) AS email,
        u.username,
        u."isBanned" AS "isBanned",
        u."isPrivate" AS "isPrivate",
        u."registrationData"::json->>'isEmailVerified' AS "isEmailVerified",
        (u."mutedUntil" AT TIME ZONE 'UTC') AS "mutedUntil",
        u."muteReason" AS "muteReason",
        -- Sum all wallets converted to USD using latest rates
        COALESCE((
          SELECT SUM((bw.balance)::numeric * (cr_sub.rate)::numeric)
          FROM balance.wallets bw
          LEFT JOIN LATERAL (
            SELECT rate
            FROM balance.currency_rate_history cr
            WHERE cr.asset::text = bw.asset::text
            ORDER BY cr."createdAt" DESC
            LIMIT 1
          ) cr_sub ON true
          WHERE bw."userId" = u.id
        ), 0.0) AS "currentBalance",
        -- Sum deposits in cents -> USD
        -- Totals from balance_statistics (in cents -> USD)
        COALESCE((
          SELECT (s.deps::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalDeposits",
        COALESCE((
          SELECT (s.withs::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalWithdrawals",
        u."createdAt",
        u."updatedAt" AS "lastLoginAt"
      FROM users.users u 
    `;

    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereConditions.push(
        `(u.username ILIKE $${paramIndex} 
          OR u.email ILIKE $${paramIndex} 
          OR u."registrationData"::json->>'email' ILIKE $${paramIndex}
          OR (u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
              AND u."registrationData"::json->>'address' ILIKE $${paramIndex}))`,
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    if (banned !== undefined) {
      whereConditions.push(`u."isBanned" = $${paramIndex}`);
      queryParams.push(banned);
      paramIndex++;
    }

    if (strategy) {
      whereConditions.push(`u."registrationStrategy" = $${paramIndex}`);
      queryParams.push(strategy);
      paramIndex++;
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add ordering
    const orderField =
      sortBy === 'createdAt'
        ? 'u."createdAt"'
        : sortBy === 'updatedAt'
          ? 'u."updatedAt"'
          : sortBy === 'username'
            ? 'u.username'
            : 'u."createdAt"';
    baseQuery += ` ORDER BY ${orderField} ${sortOrder}`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users.users u 
      ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''}
    `;

    const countResult = await this.dataSource.query(countQuery, queryParams);
    const total = parseInt(countResult[0].total);

    // Add pagination
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const users = await this.dataSource.query(baseQuery, queryParams);

    // Transform the results to match the expected interface
    const transformedUsers: IFrontendUserEntity[] = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      isBanned: user.isBanned,
      isPrivate: user.isPrivate,
      isEmailVerified: user.isEmailVerified === 'true',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      totalDeposits: (user.totalDeposits || 0).toString(),
      totalWithdrawals: (user.totalWithdrawals || 0).toString(),
      currentBalance: (user.currentBalance || 0).toString(),
      updatedAt: user.lastLoginAt || user.createdAt,
      mutedUntil: user.mutedUntil || null,
      muteReason: user.muteReason || null,
      financials: {
        totalDeposits: (user.totalDeposits || 0).toString(),
        totalWithdrawals: (user.totalWithdrawals || 0).toString(),
        totalBets: '0.00',
        totalWins: '0.00',
        currentBalance: (user.currentBalance || 0).toString(),
        netProfit: '0.00',
      },
      wallets: [],
      gameStats: {
        totalGames: 0,
        favoriteGame: 'None',
        winRate: 0,
        averageBetSize: '0.00',
      },
    }));

    const page = Math.floor(offset / limit) + 1;
    const pages = Math.ceil(total / limit);

    return {
      items: transformedUsers,
      total,
      page,
      pages,
    };
  }

  async searchUsers(query: string, limit = 20): Promise<IFrontendUserEntity[]> {
    const searchQuery = `
      SELECT 
        u.id,
        COALESCE(
          u.email,
          u."registrationData"::json->>'email',
          CASE 
            WHEN u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
              THEN u."registrationData"::json->>'address'
            WHEN u."registrationStrategy" = 'STEAM' 
              THEN COALESCE(
                u."registrationData"::json->>'steamId',
                u."registrationData"::json->>'personaName'
              )
            ELSE u.username
          END
        ) AS email,
        u.username,
        u."isBanned" AS "isBanned",
        u."isPrivate" AS "isPrivate",
        u."registrationData"::json->>'isEmailVerified' AS "isEmailVerified",
        (u."mutedUntil" AT TIME ZONE 'UTC') AS "mutedUntil",
        u."muteReason" AS "muteReason",
        COALESCE((
          SELECT SUM((bw.balance)::numeric * (cr_sub.rate)::numeric)
          FROM balance.wallets bw
          LEFT JOIN LATERAL (
            SELECT rate
            FROM balance.currency_rate_history cr
            WHERE cr.asset::text = bw.asset::text
            ORDER BY cr."createdAt" DESC
            LIMIT 1
          ) cr_sub ON true
          WHERE bw."userId" = u.id
        ), 0.0) AS "currentBalance",
        COALESCE((
          SELECT (s.deps::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalDeposits",
        COALESCE((
          SELECT (s.withs::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalWithdrawals",
        u."createdAt",
        u."updatedAt" AS "lastLoginAt"
      FROM users.users u 
      WHERE u.username ILIKE $1 
        OR u.email ILIKE $1 
        OR u."registrationData"::json->>'email' ILIKE $1
        OR (u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
            AND u."registrationData"::json->>'address' ILIKE $1)
      ORDER BY u."createdAt" DESC
      LIMIT $2
    `;

    const users = await this.dataSource.query(searchQuery, [`%${query}%`, limit]);

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      isBanned: user.isBanned,
      isPrivate: user.isPrivate,
      isEmailVerified: user.isEmailVerified === 'true',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      totalDeposits: (user.totalDeposits || 0).toString(),
      totalWithdrawals: (user.totalWithdrawals || 0).toString(),
      currentBalance: (user.currentBalance || 0).toString(),
      updatedAt: user.lastLoginAt || user.createdAt,
      mutedUntil: user.mutedUntil || null,
      muteReason: user.muteReason || null,
      financials: {
        totalDeposits: (user.totalDeposits || 0).toString(),
        totalWithdrawals: (user.totalWithdrawals || 0).toString(),
        totalBets: '0.00',
        totalWins: '0.00',
        currentBalance: (user.currentBalance || 0).toString(),
        netProfit: '0.00',
      },
      wallets: [],
      gameStats: {
        totalGames: 0,
        favoriteGame: 'None',
        winRate: 0,
        averageBetSize: '0.00',
      },
    }));
  }

  async findBannedUsers(limit = 50, offset = 0): Promise<IFrontendUserEntity[]> {
    const bannedQuery = `
      SELECT 
        u.id,
        COALESCE(
          u.email,
          u."registrationData"::json->>'email',
          CASE 
            WHEN u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
              THEN u."registrationData"::json->>'address'
            WHEN u."registrationStrategy" = 'STEAM' 
              THEN COALESCE(
                u."registrationData"::json->>'steamId',
                u."registrationData"::json->>'personaName'
              )
            ELSE u.username
          END
        ) AS email,
        u.username,
        u."isBanned" AS "isBanned",
        u."isPrivate" AS "isPrivate",
        u."registrationData"::json->>'isEmailVerified' AS "isEmailVerified",
        (u."mutedUntil" AT TIME ZONE 'UTC') AS "mutedUntil",
        u."muteReason" AS "muteReason",
        COALESCE((
          SELECT SUM((bw.balance)::numeric * (cr_sub.rate)::numeric)
          FROM balance.wallets bw
          LEFT JOIN LATERAL (
            SELECT rate
            FROM balance.currency_rate_history cr
            WHERE cr.asset::text = bw.asset::text
            ORDER BY cr."createdAt" DESC
            LIMIT 1
          ) cr_sub ON true
          WHERE bw."userId" = u.id
        ), 0.0) AS "currentBalance",
        COALESCE((
          SELECT (s.deps::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalDeposits",
        COALESCE((
          SELECT (s.withs::numeric / 100.0)
          FROM balance.balance_statistics s
          WHERE s."userId" = u.id
        ), 0.0) AS "totalWithdrawals",
        u."createdAt",
        u."updatedAt" AS "lastLoginAt"
      FROM users.users u 
      WHERE u."isBanned" = true
      ORDER BY u."updatedAt" DESC
      LIMIT $1 OFFSET $2
    `;

    const users = await this.dataSource.query(bannedQuery, [limit, offset]);

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      isBanned: user.isBanned,
      isPrivate: user.isPrivate,
      isEmailVerified: user.isEmailVerified === 'true',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      totalDeposits: (user.totalDeposits || 0).toString(),
      totalWithdrawals: (user.totalWithdrawals || 0).toString(),
      currentBalance: (user.currentBalance || 0).toString(),
      updatedAt: user.lastLoginAt || user.createdAt,
      mutedUntil: user.mutedUntil || null,
      muteReason: user.muteReason || null,
      financials: {
        totalDeposits: (user.totalDeposits || 0).toString(),
        totalWithdrawals: (user.totalWithdrawals || 0).toString(),
        totalBets: '0.00',
        totalWins: '0.00',
        currentBalance: (user.currentBalance || 0).toString(),
        netProfit: '0.00',
      },
      wallets: [],
      gameStats: {
        totalGames: 0,
        favoriteGame: 'None',
        winRate: 0,
        averageBetSize: '0.00',
      },
    }));
  }

  async findById(id: string): Promise<IFrontendUserEntity> {
    // First get basic user info
    const userQuery = `
      WITH latest_rates AS (
        SELECT DISTINCT ON (asset) asset, rate
        FROM balance.currency_rate_history
        ORDER BY asset, "createdAt" DESC
      ),
      user_stats AS (
        SELECT 
          "userId",
          (deps::numeric / 100.0) AS "totalDeposits",
          (withs::numeric / 100.0) AS "totalWithdrawals"
        FROM balance.balance_statistics
        WHERE "userId" = $1
      )
      SELECT 
        u.id,
        COALESCE(
          u.email,
          u."registrationData"::json->>'email',
          CASE 
            WHEN u."registrationStrategy" IN ('PHANTOM', 'METAMASK') 
              THEN u."registrationData"::json->>'address'
            WHEN u."registrationStrategy" = 'STEAM' 
              THEN COALESCE(
                u."registrationData"::json->>'steamId',
                u."registrationData"::json->>'personaName'
              )
            ELSE u.username
          END
        ) AS email,
        u.username,
        u."isBanned" AS "isBanned",
        u."isPrivate" AS "isPrivate",
        u."registrationData"::json->>'isEmailVerified' AS "isEmailVerified",
        (u."mutedUntil" AT TIME ZONE 'UTC') AS "mutedUntil",
        u."muteReason" AS "muteReason",
        (u."cookieConsentAcceptedAt" AT TIME ZONE 'UTC') AS "cookieConsentAcceptedAt",
        COALESCE((
          SELECT SUM((bw.balance)::numeric * COALESCE(lr.rate, 0)::numeric)
          FROM balance.wallets bw
          LEFT JOIN latest_rates lr ON lr.asset = bw.asset::text
          WHERE bw."userId" = u.id
        ), 0.0) AS "currentBalance",
        COALESCE(us."totalDeposits", 0.0) AS "totalDeposits",
        COALESCE(us."totalWithdrawals", 0.0) AS "totalWithdrawals",
        u."createdAt",
        u."updatedAt" AS "lastLoginAt"
      FROM users.users u 
      LEFT JOIN user_stats us ON us."userId" = u.id
      WHERE u.id = $1
    `;

    const users = await this.dataSource.query(userQuery, [id]);

    if (users.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const user = users[0];

    // Get additional financial data
    const financialsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN operation = 'DEPOSIT' THEN "amountCents" ELSE 0 END), 0) / 100.0 as totalDeposits,
        COALESCE(SUM(CASE WHEN operation = 'WITHDRAWAL' THEN "amountCents" ELSE 0 END), 0) / 100.0 as totalWithdrawals,
        COALESCE(SUM(CASE WHEN operation = 'BET' THEN "amountCents" ELSE 0 END), 0) / 100.0 as totalBets,
        COALESCE(SUM(CASE WHEN operation = 'WIN' THEN "amountCents" ELSE 0 END), 0) / 100.0 as totalWins
      FROM balance.balance_history
      WHERE "userId" = $1
    `;
    const financialsResult = await this.dataSource.query(financialsQuery, [id]);
    const financials = financialsResult[0];

    // Get wallet information
    const walletsQuery = `
      SELECT 
        bw.asset,
        bw.balance,
        pw.addresses
      FROM balance.wallets bw 
      LEFT JOIN payments.wallets pw ON bw."userId" = pw."userId"
      WHERE bw."userId" = $1
    `;
    const wallets = await this.dataSource.query(walletsQuery, [id]);

    // Get game statistics
    const gameStatsQuery = `
      WITH balance_stats AS (
        SELECT 
          "betCount",
          "winCount",
          "bets"::numeric as bets
        FROM balance.balance_statistics
        WHERE "userId" = $1
      ),
      favorite_game AS (
        SELECT game, COUNT(*) as count
        FROM games.user_bets
        WHERE "userId" = $1
        GROUP BY game
        ORDER BY count DESC
        LIMIT 1
      )
      SELECT 
        COALESCE(bs."betCount", 0) as "totalGames",
        fg.game as "favoriteGameType",
        COALESCE(bs."winCount", 0) as "winCount",
        COALESCE(bs.bets, 0) as "bets"
      FROM balance_stats bs
      LEFT JOIN favorite_game fg ON true
    `;

    const gameStatsResult = await this.dataSource.query(gameStatsQuery, [id]);
    const stats = gameStatsResult[0] || {};

    const totalGames = parseInt(stats.totalGames || '0', 10);
    const winCount = parseInt(stats.winCount || '0', 10);
    const betsCents = parseFloat(stats.bets || '0');

    const winRate = totalGames > 0 ? Number(((winCount / totalGames) * 100).toFixed(2)) : 0;
    const averageBetSize = totalGames > 0 ? (betsCents / 100 / totalGames).toFixed(2) : '0.00';

    const favoriteGame = stats.favoriteGameType
      ? GAME_DISPLAY_NAMES[stats.favoriteGameType as GameTypeEnum] || stats.favoriteGameType
      : 'None';

    const gameStats = {
      totalGames,
      favoriteGame,
      winRate,
      averageBetSize,
    };

    // Calculate net profit
    const netProfit = parseFloat(financials.totalWins || 0) - parseFloat(financials.totalBets || 0);
    const netProfitString = isNaN(netProfit) ? '0.00' : netProfit.toString();

    // Return the detailed user object that matches frontend expectations
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isBanned: user.isBanned,
      isPrivate: user.isPrivate,
      isEmailVerified: user.isEmailVerified === 'true',
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      totalDeposits: user.totalDeposits.toString(),
      totalWithdrawals: user.totalWithdrawals.toString(),
      currentBalance: user.currentBalance.toString(),
      updatedAt: user.lastLoginAt || user.createdAt,
      mutedUntil: user.mutedUntil || null,
      muteReason: user.muteReason || null,
      cookieConsentAcceptedAt: user.cookieConsentAcceptedAt || null,
      financials: {
        totalDeposits: user.totalDeposits.toString(),
        totalWithdrawals: user.totalWithdrawals.toString(),
        totalBets: (financials.totalBets || 0).toString(),
        totalWins: (financials.totalWins || 0).toString(),
        currentBalance: (user.currentBalance || 0).toString(),
        netProfit: netProfitString,
      },
      wallets: wallets.map((wallet: any) => ({
        asset: wallet.asset || '',
        balance: (wallet.balance || 0).toString(),
        address:
          typeof wallet.addresses === 'object'
            ? JSON.stringify(wallet.addresses)
            : wallet.addresses || '',
      })),
      gameStats,
    };
  }

  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<UserTransactionsResponseDto> {
    const offset = (page - 1) * limit;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM balance.balance_history 
      WHERE "userId" = $1
    `;
    const countResult = await this.dataSource.query(countQuery, [userId]);
    const total = parseInt(countResult[0].total, 10);

    const transactionsQuery = `
      SELECT 
        "operationId" as id,
        operation as type,
        "amount"::numeric as amount,
        asset,
        metadata,
        'COMPLETED' as status,
        "createdAt"
      FROM balance.balance_history 
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT $2 OFFSET $3
    `;
    const transactions = await this.dataSource.query(transactionsQuery, [userId, limit, offset]);

    const pages = Math.ceil(total / limit);

    return {
      items: transactions.map((tx: any) => ({
        id: tx.id || '',
        type: tx.type || '',
        amount: (tx.amount || 0).toString(),
        asset: tx.asset || '',
        metadata: typeof tx.metadata === 'object' ? JSON.stringify(tx.metadata) : tx.metadata || '',
        status: tx.status || 'COMPLETED',
        createdAt: tx.createdAt || new Date(),
      })),
      total,
      page,
      pages,
    };
  }

  async banUser(id: string): Promise<IFrontendUserEntity> {
    // First get the user to check if already banned
    const userQuery = `
      SELECT u."isBanned" FROM users.users u WHERE u.id = $1
    `;
    const users = await this.dataSource.query(userQuery, [id]);

    if (users.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (users[0].isBanned) {
      throw new Error('User is already banned');
    }

    // Update the user to ban them
    await this.dataSource.query(
      `UPDATE users.users SET "isBanned" = true, "updatedAt" = NOW() WHERE id = $1`,
      [id],
    );

    // Return the updated user
    return this.findById(id);
  }

  async unbanUser(id: string): Promise<IFrontendUserEntity> {
    // First get the user to check if not banned
    const userQuery = `
      SELECT u."isBanned" FROM users.users u WHERE u.id = $1
    `;
    const users = await this.dataSource.query(userQuery, [id]);

    if (users.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    if (!users[0].isBanned) {
      throw new Error('User is not banned');
    }

    // Update the user to unban them
    await this.dataSource.query(
      `UPDATE users.users SET "isBanned" = false, "updatedAt" = NOW() WHERE id = $1`,
      [id],
    );

    // Return the updated user
    return this.findById(id);
  }

  async bulkBanUsers(userIds: string[]): Promise<IFrontendUserEntity[]> {
    // Get users that are not banned
    const nonBannedQuery = `
      SELECT u.id FROM users.users u 
      WHERE u.id = ANY($1) AND u."isBanned" = false
    `;
    const nonBannedUsers = await this.dataSource.query(nonBannedQuery, [userIds]);

    if (nonBannedUsers.length === 0) {
      throw new Error('All specified users are already banned');
    }

    // Ban the non-banned users
    const nonBannedIds = nonBannedUsers.map((u) => u.id);
    await this.dataSource.query(
      `UPDATE users.users SET "isBanned" = true, "updatedAt" = NOW() WHERE id = ANY($1)`,
      [nonBannedIds],
    );

    // Return all requested users
    const results: IFrontendUserEntity[] = [];
    for (const userId of userIds) {
      const user = await this.findById(userId);
      results.push(user);
    }

    return results;
  }

  async getUsersCount(): Promise<{ total: number; banned: number; active: number }> {
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN u."isBanned" = true THEN 1 END) as banned
      FROM users.users u
    `;
    const result = await this.dataSource.query(countQuery);
    const total = parseInt(result[0].total);
    const banned = parseInt(result[0].banned);

    return {
      total,
      banned,
      active: total - banned,
    };
  }

  async getComprehensiveStats(): Promise<{
    total: number;
    banned: number;
    active: number;
    byStrategy: Record<string, number>;
    recentRegistrations: number;
    recentBans: number;
  }> {
    const totalQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN u."isBanned" = true THEN 1 END) as banned
      FROM users.users u
    `;
    const totalResult = await this.dataSource.query(totalQuery);
    const total = parseInt(totalResult[0].total);
    const banned = parseInt(totalResult[0].banned);

    // Get statistics by registration strategy
    const strategyQuery = `
      SELECT 
        u."registrationStrategy" as strategy,
        COUNT(*) as count
      FROM users.users u
      GROUP BY u."registrationStrategy"
    `;
    const strategyStats = await this.dataSource.query(strategyQuery);

    const byStrategy: Record<string, number> = {};
    strategyStats.forEach((stat: { strategy: string; count: string }) => {
      byStrategy[stat.strategy] = parseInt(stat.count, 10);
    });

    // Recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRegistrationsQuery = `
      SELECT COUNT(*) as count
      FROM users.users u
      WHERE u."createdAt" >= $1
    `;
    const recentRegistrationsResult = await this.dataSource.query(recentRegistrationsQuery, [
      sevenDaysAgo,
    ]);
    const recentRegistrations = parseInt(recentRegistrationsResult[0].count);

    // Recent bans (last 7 days)
    const recentBansQuery = `
      SELECT COUNT(*) as count
      FROM users.users u
      WHERE u."isBanned" = true AND u."updatedAt" >= $1
    `;
    const recentBansResult = await this.dataSource.query(recentBansQuery, [sevenDaysAgo]);
    const recentBans = parseInt(recentBansResult[0].count);

    return {
      total,
      banned,
      active: total - banned,
      byStrategy,
      recentRegistrations,
      recentBans,
    };
  }

  async getUserActivity(id: string): Promise<{
    userId: string;
    registrationDate: Date;
    lastActivity: Date;
    totalSessions: number;
    bannedHistory: Array<{ bannedAt: Date; unbannedAt?: Date; reason?: string }>;
  }> {
    const user = await this.findById(id);

    // This would typically come from session/activity tables
    // For now, we'll return basic info from user table
    return {
      userId: user.id,
      registrationDate: user.createdAt,
      lastActivity: user.lastLoginAt || user.createdAt,
      totalSessions: 0, // Would calculate from sessions table
      bannedHistory: [], // Would get from audit logs or ban history table
    };
  }

  // Removed unused getAssetRate; rates are taken from balance.currency_rate_history

  async adjustBalance(
    userId: string,
    asset: string,
    amount: number,
    reason?: string,
  ): Promise<IFrontendUserEntity> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      throw new BadRequestException('Backend URL or admin secret is not configured');
    }

    const payload = {
      userId,
      asset,
      amount: Math.abs(amount).toString(),
      reason,
    };

    const response = await fetch(`${backendUrl}/v1/balance-admin/credit`, {
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
        JSON.stringify(errorData);
      throw new BadRequestException(`Backend API error: ${response.status} - ${errorMessage}`);
    }

    // After backend updates balance and emits WS, reflect updated data to admin panel view
    return this.findById(userId);
  }

  async assignAdminRole(
    userId: string,
    role: AdminRole,
    assignedByAdminId: string,
    email?: string,
    name?: string,
  ): Promise<AdminEntity> {
    if (role === AdminRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign SUPER_ADMIN role to regular users');
    }

    if (role !== AdminRole.ADMIN && role !== AdminRole.MODERATOR) {
      throw new BadRequestException('Invalid role. Only ADMIN or MODERATOR roles are allowed');
    }

    const admin = await this.adminRepository.findOne({
      where: { userId },
    });

    if (admin) {
      if (admin.role === AdminRole.SUPER_ADMIN) {
        throw new BadRequestException('Cannot modify SUPER_ADMIN accounts');
      }
      admin.role = role;
      admin.updatedAt = new Date();
      return await this.adminRepository.save(admin);
    }

    if (!email || !name) {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'email', 'username', 'registrationData'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      if (!email) {
        email = user.email;
        if (
          !email &&
          user.registrationData &&
          typeof user.registrationData === 'object' &&
          'email' in user.registrationData
        ) {
          email = (user.registrationData as any).email;
        }
      }

      if (!name) {
        name = user.username || email;
      }
    }

    if (!email || !name) {
      throw new BadRequestException(
        'Email and name are required when creating a new admin account',
      );
    }

    const temporaryPassword = randomBytes(16).toString('hex');
    const hashedPassword = await PasswordUtil.hash(temporaryPassword);

    // Use upsert to prevent race condition on userId unique constraint
    try {
      const result = await this.adminRepository
        .createQueryBuilder()
        .insert()
        .into(AdminEntity)
        .values({
          userId,
          email,
          name,
          role,
          password: hashedPassword,
          isActive: true,
        })
        .orUpdate({
          conflict_target: ['userId'],
          overwrite: ['role', 'email', 'name', 'updatedAt'],
        })
        .returning('*')
        .execute();

      const savedAdmin = result.raw[0] as AdminEntity;

      // Log temporary password for admin to set proper password
      // In production, this should be sent via secure email/notification
      console.warn(
        `[SECURITY] Temporary password for admin ${savedAdmin.email} (ID: ${savedAdmin.id}): ${temporaryPassword}. Admin must change password on first login.`,
      );

      return savedAdmin;
    } catch (error) {
      // If upsert fails due to race condition, try to fetch existing admin
      const existingAdmin = await this.adminRepository.findOne({
        where: { userId },
      });

      if (existingAdmin) {
        if (existingAdmin.role === AdminRole.SUPER_ADMIN) {
          throw new BadRequestException('Cannot modify SUPER_ADMIN accounts');
        }
        existingAdmin.role = role;
        existingAdmin.updatedAt = new Date();
        return await this.adminRepository.save(existingAdmin);
      }

      throw error;
    }
  }

  async removeAdminRole(userId: string): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { userId },
    });

    if (!admin) {
      throw new NotFoundException('Admin role not found for this user');
    }

    // If admin is SUPER_ADMIN, we cannot delete it, only unlink userId
    if (admin.role === AdminRole.SUPER_ADMIN) {
      await this.adminRepository.update(admin.id, {
        userId: undefined,
      });
      return;
    }

    // For MODERATOR and ADMIN roles, delete the admin record completely
    // since it was created specifically for this user
    await this.adminRepository.remove(admin);
  }

  async getUserAdminRole(
    userId: string,
  ): Promise<{ role: AdminRole | null; userId: string; adminId?: string }> {
    const admin = await this.adminRepository.findOne({
      where: { userId },
      select: ['id', 'role'],
    });

    return {
      role: admin?.role ?? null,
      userId,
      adminId: admin?.id,
    };
  }

  async muteUser(
    userId: string,
    durationMinutes: number,
    reason: string | undefined,
    adminId: string | null,
  ): Promise<{ success: boolean; userId: string }> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      throw new BadRequestException('Backend URL or admin secret is not configured');
    }

    const payload = {
      durationMinutes,
      reason,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-simulator-secret': adminApiSecret,
    };

    if (adminId) {
      headers['x-admin-id'] = adminId;
    }

    const response = await fetch(`${backendUrl}/v1/chat-admin/users/${userId}/mute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message?.message ||
        errorData.message ||
        errorData.error ||
        JSON.stringify(errorData);
      throw new BadRequestException(`Backend API error: ${response.status} - ${errorMessage}`);
    }

    return await response.json();
  }

  async unmuteUser(
    userId: string,
    adminId: string | null,
  ): Promise<{ success: boolean; userId: string }> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      throw new BadRequestException('Backend URL or admin secret is not configured');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-simulator-secret': adminApiSecret,
    };

    if (adminId) {
      headers['x-admin-id'] = adminId;
    }

    const response = await fetch(`${backendUrl}/v1/chat-admin/users/${userId}/mute`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message?.message ||
        errorData.message ||
        errorData.error ||
        JSON.stringify(errorData);
      throw new BadRequestException(`Backend API error: ${response.status} - ${errorMessage}`);
    }

    return await response.json();
  }
}
