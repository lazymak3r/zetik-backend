import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface BetArchiveItem {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface BetArchiveResponse {
  items: BetArchiveItem[];
  total: number;
}

export interface BetExportQuery {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  limit?: number;
  offset?: number;
  userId?: string; // Filter by user
}

export interface BetArchiveQuery extends BetExportQuery {
  sortBy?: 'date';
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class BetsReportService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private parseDateRange(input: { from?: string; to?: string; days?: number }): {
    from?: Date;
    to?: Date;
  } {
    const { from, to, days } = input;

    const now = new Date();

    if (!from && !to && days && days > 0) {
      const fromDate = new Date(now);
      fromDate.setUTCDate(now.getUTCDate() - (days - 1));
      // start of day UTC
      fromDate.setUTCHours(0, 0, 0, 0);
      const toDate = new Date(now);
      toDate.setUTCHours(23, 59, 59, 999);
      return { from: fromDate, to: toDate };
    }

    const result: { from?: Date; to?: Date } = {};
    if (from) {
      const f = new Date(from);
      if (!isNaN(f.getTime())) {
        f.setUTCHours(0, 0, 0, 0);
        result.from = f;
      }
    }
    if (to) {
      const t = new Date(to);
      if (!isNaN(t.getTime())) {
        t.setUTCHours(23, 59, 59, 999);
        result.to = t;
      }
    }

    return result;
  }

  async getArchiveByDay(query: BetArchiveQuery): Promise<BetArchiveResponse> {
    // Set default values for pagination and sorting
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 1000);
    const offset = Math.max(query.offset ?? 0, 0);
    const sortOrder = (query.sortOrder ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build subquery that aggregates counts by day
    const dailyCountsQb = this.dataSource
      .createQueryBuilder()
      .select("date_trunc('day', bet.createdAt)", 'day')
      .addSelect('COUNT(*)::int', 'count')
      .from('games.user_bets', 'bet');

    // Add userId filter if provided
    if (query.userId) {
      dailyCountsQb.where('bet.userId = :userId', { userId: query.userId });
    }

    dailyCountsQb.groupBy("date_trunc('day', bet.createdAt)");

    // Outer query: format date, include total via window function, paginate
    const qb = this.dataSource
      .createQueryBuilder()
      .select("to_char(dc.day, 'YYYY-MM-DD')", 'date')
      .addSelect('dc.count', 'count')
      .addSelect('COUNT(*) OVER()', 'total')
      .from('(' + dailyCountsQb.getQuery() + ')', 'dc')
      .setParameters(dailyCountsQb.getParameters())
      .orderBy('dc.day', sortOrder)
      .limit(limit)
      .offset(offset);

    const rows = await qb.getRawMany();
    if (rows.length === 0) {
      return {
        items: [],
        total: 0,
      };
    }

    const total = Number(rows[0].total);
    const items = rows.map((r: any) => ({
      date: r.date,
      count: Number(r.count),
    })) as BetArchiveItem[];

    return {
      items,
      total,
    };
  }

  async exportBets(query: BetExportQuery): Promise<any[]> {
    const { from, to } = this.parseDateRange(query);

    const params: any[] = [];
    let paramIndex = 1;
    let where = 'WHERE 1=1';

    if (query.userId) {
      where += ` AND bet."userId" = $${paramIndex}`;
      params.push(query.userId);
      paramIndex++;
    }

    if (from) {
      where += ` AND bet."createdAt" >= $${paramIndex}`;
      params.push(from.toISOString());
      paramIndex++;
    }
    if (to) {
      where += ` AND bet."createdAt" <= $${paramIndex}`;
      params.push(to.toISOString());
      paramIndex++;
    }

    const limit = Math.min(Math.max(query.limit ?? 500, 1), 5000);
    const offset = Math.max(query.offset ?? 0, 0);

    const sql = `
      SELECT
        bet.game,
        bet."gameName",
        bet."betId",
        bet."userId",
        bet."betAmount",
        bet.asset,
        bet.multiplier,
        bet.payout,
        bet."betAmountUsd",
        bet."payoutUsd",
        bet."createdAt",
        bet."updatedAt"
      FROM games.user_bets bet
      ${where}
      ORDER BY bet."createdAt" ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    const rows = await this.dataSource.query(sql, params);

    // Map to the requested shape as closely as possible
    return rows.map((row: any) => {
      const createdAt = new Date(row.createdAt);
      const updatedAt = new Date(row.updatedAt);
      const betAmountNum = Number(row.betAmount);
      const payoutNum = Number(row.payout);
      const multiplierNum = row.multiplier != null ? Number(row.multiplier) : 0;

      return {
        id: row.betId,
        user_id: row.userId,
        data: {
          id: row.betId,
          type: 'casino',
          nonce: null,
          value: null,
          active: false,
          amount: isNaN(betAmountNum) ? 0 : betAmountNum,
          gameId: null,
          payout: isNaN(payoutNum) ? 0 : payoutNum,
          userId: row.userId,
          currency: (row.asset || '').toString().toLowerCase(),
          gameName: (row.gameName || row.game || '').toString().toLowerCase(),
          createdAt: createdAt.getTime(),
          updatedAt: updatedAt.getTime(),
          stateLimbo: null,
          serverSeedId: null,
          expectedAmount: isNaN(betAmountNum * multiplierNum)
            ? 0
            : Number((betAmountNum * multiplierNum).toFixed(8)),
          payoutMultiplier: isNaN(multiplierNum) ? 0 : multiplierNum,
        },
      };
    });
  }
}
