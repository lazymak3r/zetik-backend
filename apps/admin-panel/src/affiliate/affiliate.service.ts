import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { AffiliateCampaignEntity } from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';

// Constants for pagination and queries
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_REFERRALS_PAGE_SIZE = 10;

export interface IFindAllOptions {
  page?: number;
  limit?: number;
  offset?: number;
  ownerName?: string;
  campaignCode?: string;
}

export interface ICampaignWithDetails extends Omit<AffiliateCampaignEntity, 'totalCommission'> {
  owner: {
    id: string;
    email: string | null;
    username: string;
    registrationStrategy?: string;
    registrationData?: any;
  };
  uniqueReferrals: number;
  totalCommission: number;
}

export interface IPaginatedCampaignsResponse {
  data: ICampaignWithDetails[];
  total: number;
  page: number;
  limit: number;
}

export interface ICampaignDetailsResponse {
  id: string;
  userId: string;
  code: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  totalCommission: number;
  totalReferrals: number;
  owner: {
    id: string;
    email: string | null;
    username: string;
  };
}

export interface IReferralUser {
  userId: string;
  email: string | null;
  username: string;
  totalEarnedUsd: number;
}

export interface ICampaignReferralsResponse {
  referrals: IReferralUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IDeleteCampaignResult {
  success: boolean;
  message: string;
  campaign?: AffiliateCampaignEntity;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);
  private ratesCache: Map<string, number> = new Map();
  private ratesCacheExpiry: number = 0;
  private readonly RATE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(AffiliateCampaignEntity)
    private readonly campaignRepository: Repository<AffiliateCampaignEntity>,
    private readonly configService: ConfigService,
  ) {}

  private async getCurrencyRates(assets: string[]): Promise<Map<string, number>> {
    // Atomic cache validity check - single point of truth prevents race condition
    if (this.ratesCache.size > 0 && Date.now() < this.ratesCacheExpiry) {
      const result = new Map<string, number>();
      for (const asset of assets) {
        const rate = this.ratesCache.get(asset);
        if (rate !== undefined) {
          result.set(asset, rate);
        }
      }
      if (result.size === assets.length) {
        return result;
      }
    }

    if (assets.length === 0) {
      return new Map();
    }

    try {
      const result = await this.dataSource.query(
        `SELECT DISTINCT ON (asset) asset, rate
         FROM balance.currency_rate_history
         WHERE asset = ANY($1)
         ORDER BY asset, "createdAt" DESC`,
        [assets],
      );

      const ratesMap = new Map<string, number>(
        result.map((r: any) => [r.asset, parseFloat(r.rate)]),
      );

      // Atomic cache update - expiry and cache updated together
      const newCache = new Map(this.ratesCache);
      for (const [asset, rate] of ratesMap.entries()) {
        newCache.set(asset, rate);
      }
      this.ratesCache = newCache;
      this.ratesCacheExpiry = Date.now() + this.RATE_CACHE_TTL_MS;

      return ratesMap;
    } catch (error) {
      console.error('Failed to fetch currency rates:', error);
      return new Map();
    }
  }

  async findAll(options: IFindAllOptions = {}): Promise<IPaginatedCampaignsResponse> {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      offset = (page - 1) * limit,
      ownerName,
      campaignCode,
    } = options;

    let query = this.campaignRepository.createQueryBuilder('ac');

    // Safe parameterized queries to prevent SQL injection
    if (ownerName) {
      query = query.andWhere(
        `EXISTS (
          SELECT 1 FROM users.users u 
          WHERE u.id = ac."userId" 
          AND u.username ILIKE :ownerName
        )`,
        { ownerName: `%${ownerName}%` },
      );
    } else if (campaignCode) {
      query = query.andWhere('ac.code ILIKE :campaignCode', {
        campaignCode: `%${campaignCode}%`,
      });
    }

    const total = await query.getCount();

    query = query.offset(offset).limit(limit).orderBy('ac.createdAt', 'DESC');

    const campaigns = await query.getMany();

    // Batch fetch all required data to avoid N+1 queries
    const ownerIds = campaigns.map((c) => c.userId);
    const campaignCodes = campaigns.map((c) => c.code);

    // Fetch all owners in one query
    const ownersResult = await this.dataSource.query(
      `SELECT 
        u.id, 
        u.username,
        CASE 
          WHEN u."registrationStrategy" = 'EMAIL' THEN u."registrationData"->>'email'
          WHEN u."registrationStrategy" = 'GOOGLE' THEN u."registrationData"->>'email'
          ELSE NULL
        END as email
       FROM users.users u
       WHERE u.id = ANY($1)`,
      [ownerIds],
    );
    const ownersMap = new Map<string, ICampaignWithDetails['owner']>(
      ownersResult.map((o: any) => [
        o.id,
        {
          id: o.id,
          username: o.username,
          email: o.email,
        },
      ]),
    );

    // Fetch all earnings and referral counts in one query
    const earningsResult = await this.dataSource.query(
      `SELECT 
        ae."campaignCode",
        COUNT(DISTINCT ae."referredUserId") as referral_count,
        ae.asset,
        SUM(ae.earned::numeric) as total_earned
       FROM affiliate.affiliate_earnings ae
       WHERE ae."campaignCode" = ANY($1)
       GROUP BY ae."campaignCode", ae.asset`,
      [campaignCodes],
    );

    // Group earnings by campaign code
    const earningsByCampaign = new Map<string, Array<{ asset: string; total_earned: string }>>();
    const referralCountsByCampaign = new Map<string, number>();

    for (const earning of earningsResult) {
      const code = earning.campaignCode;

      if (!earningsByCampaign.has(code)) {
        earningsByCampaign.set(code, []);
      }
      earningsByCampaign.get(code)!.push({
        asset: earning.asset,
        total_earned: earning.total_earned,
      });

      // Store referral count (it's the same for all assets of the same campaign)
      if (!referralCountsByCampaign.has(code)) {
        referralCountsByCampaign.set(code, parseInt(earning.referral_count || '0', 10));
      }
    }

    // Fetch all currency rates using cache
    const allAssets = [...new Set(earningsResult.map((r: any) => r.asset))] as string[];
    const ratesMap = await this.getCurrencyRates(allAssets);

    // Build enhanced campaigns with fetched data
    const enhancedCampaigns: ICampaignWithDetails[] = campaigns.map(
      (campaign): ICampaignWithDetails => {
        const owner: ICampaignWithDetails['owner'] = ownersMap.get(campaign.userId) || {
          id: campaign.userId,
          email: null,
          username: 'Unknown',
        };

        const earnings = earningsByCampaign.get(campaign.code) || [];
        let totalCommissionUsd = 0;

        for (const earning of earnings) {
          const earnedCrypto = parseFloat(earning.total_earned || '0');
          const rate = ratesMap.get(earning.asset) ?? 0;
          totalCommissionUsd += earnedCrypto * rate;
        }

        return {
          ...campaign,
          owner,
          uniqueReferrals: referralCountsByCampaign.get(campaign.code) || 0,
          totalCommission: totalCommissionUsd,
        };
      },
    );

    return {
      data: enhancedCampaigns,
      total,
      page,
      limit,
    };
  }

  async getCampaignDetails(campaignId: string): Promise<ICampaignDetailsResponse | null> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      return null;
    }

    // Execute all queries in parallel
    const [ownerResult, earningsResult] = await Promise.all([
      // Query 1: Get owner details
      this.dataSource.query(
        `SELECT 
          u.id, 
          u.username,
          CASE 
            WHEN u."registrationStrategy" = 'EMAIL' THEN u."registrationData"->>'email'
            WHEN u."registrationStrategy" = 'GOOGLE' THEN u."registrationData"->>'email'
            ELSE NULL
          END as email
         FROM users.users u
         WHERE u.id = $1`,
        [campaign.userId],
      ),
      // Query 2: Get earnings and referral count in one query
      this.dataSource.query(
        `SELECT 
          COUNT(DISTINCT ae."referredUserId") as referral_count,
          ae.asset,
          SUM(ae.earned::numeric) as total_earned
         FROM affiliate.affiliate_earnings ae
         WHERE ae."campaignCode" = $1
         GROUP BY ae.asset`,
        [campaign.code],
      ),
    ]);

    const owner = ownerResult[0] || {
      id: campaign.userId,
      email: null,
      username: 'Unknown',
    };

    // Get currency rates using cache
    const allAssets = earningsResult.map((r: any) => r.asset) as string[];
    const ratesMap = await this.getCurrencyRates(allAssets);

    // Calculate total commission and referral count
    let totalCommissionUsd = 0;
    let totalReferralsCount = 0;

    for (const earning of earningsResult) {
      const earnedCrypto = parseFloat(earning.total_earned || '0');
      const rate = ratesMap.get(earning.asset) ?? 0;
      totalCommissionUsd += earnedCrypto * rate;

      // Referral count is the same for all assets, so take it once
      if (totalReferralsCount === 0) {
        totalReferralsCount = parseInt(earning.referral_count || '0', 10);
      }
    }

    return {
      ...campaign,
      totalCommission: totalCommissionUsd,
      totalReferrals: totalReferralsCount,
      owner,
    } as ICampaignDetailsResponse;
  }

  async getCampaignReferrals(
    campaignId: string,
    page: number = 1,
    limit: number = DEFAULT_REFERRALS_PAGE_SIZE,
  ): Promise<ICampaignReferralsResponse | null> {
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
      select: ['code'],
    });

    if (!campaign) {
      return null;
    }

    const offset = (page - 1) * limit;

    // Single query with window function to get both total count and paginated results
    // This eliminates the N+1 redundant count query
    const result = await this.dataSource.query(
      `WITH user_earnings AS (
        SELECT 
          ae."referredUserId" as user_id,
          ae.asset,
          SUM(ae.earned::numeric) as total_earned
        FROM affiliate.affiliate_earnings ae
        WHERE ae."campaignCode" = $1
        GROUP BY ae."referredUserId", ae.asset
      ),
      latest_rates AS (
        SELECT DISTINCT ON (asset) asset, rate
        FROM balance.currency_rate_history
        ORDER BY asset, "createdAt" DESC
      ),
      user_earnings_usd AS (
        SELECT 
          ue.user_id,
          SUM(ue.total_earned * COALESCE(lr.rate, 0)) as total_earned_usd,
          COUNT(*) OVER () as total_count
        FROM user_earnings ue
        LEFT JOIN latest_rates lr ON lr.asset = ue.asset
        GROUP BY ue.user_id
      )
      SELECT 
        ueu.user_id as "userId",
        CASE 
          WHEN u."registrationStrategy" = 'EMAIL' THEN u."registrationData"->>'email'
          WHEN u."registrationStrategy" = 'GOOGLE' THEN u."registrationData"->>'email'
          ELSE NULL
        END as email,
        u.username,
        ueu.total_earned_usd as "totalEarnedUsd",
        ueu.total_count::integer
      FROM user_earnings_usd ueu
      INNER JOIN users.users u ON u.id = ueu.user_id
      ORDER BY ueu.total_earned_usd DESC
      LIMIT $2 OFFSET $3`,
      [campaign.code, limit, offset],
    );

    const totalReferralsCount = result.length > 0 ? result[0].total_count : 0;
    const referralsResult = result.map((r: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { total_count, ...referral } = r;
      return referral;
    });

    // Convert totalEarnedUsd from string to number
    const referrals = referralsResult.map((r: any) => ({
      userId: r.userId,
      email: r.email,
      username: r.username,
      totalEarnedUsd: parseFloat(r.totalEarnedUsd || '0'),
    }));

    return {
      referrals,
      pagination: {
        page,
        limit,
        total: totalReferralsCount,
        totalPages: Math.ceil(totalReferralsCount / limit),
      },
    } as ICampaignReferralsResponse;
  }

  async deleteCampaign(campaignId: string): Promise<IDeleteCampaignResult> {
    const backendUrl = this.configService.get<string>('common.backendUrl');
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    if (!backendUrl || !adminApiSecret) {
      return {
        success: false,
        message: 'Backend URL or admin secret is not configured',
      };
    }

    try {
      const response = await fetch(`${backendUrl}/v1/affiliate-admin/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': adminApiSecret,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message?.message ||
          errorData.message ||
          errorData.error ||
          JSON.stringify(errorData);

        return {
          success: false,
          message: `${response.status === 404 ? 'Campaign not found' : errorMessage}`,
        };
      }

      const result = await response.json();

      this.logger.log(
        `Campaign ${campaignId} deleted via backend. Cache invalidated: ${result.cacheInvalidatedCount} entries`,
      );

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to delete campaign via backend', {
        campaignId,
        error: errorMessage,
      });

      return {
        success: false,
        message: `Failed to delete campaign: ${errorMessage}`,
      };
    }
  }
}
