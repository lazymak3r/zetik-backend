import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AffiliateCampaignEntity,
  AffiliateCommissionEntity,
  AffiliateCommissionOperationEnum,
  AffiliateEarningsEntity,
  AffiliateWalletEntity,
  AssetTypeEnum,
  BalanceOperationEnum,
  BalanceStatisticEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { isUUID } from 'class-validator';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { BalanceService } from '../balance/balance.service';
import { CryptoConverterService } from '../balance/services/crypto-converter.service';
import { affiliateConfig } from '../config/affiliate.config';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../websocket/services/notification.service';
import {
  AffiliateClaimResponseDto,
  AffiliateCommissionDetailDto,
  AffiliateStatisticsResponseDto,
} from './dto/affiliate-commissions.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignUsersResponseDto } from './dto/campaign-users-response.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ReferredUsersResponseDto, ReferredUsersSortEnum } from './dto/referred-user-profile.dto';
import { CampaignUsersParams } from './interfaces/campaign-users-params.interface';
import { AffiliateWalletService } from './services/affiliate-wallet.service';

// Type-safe interfaces for raw query results
interface EarningsQueryResult {
  userId: string;
  asset: string;
  totalCommission: string;
}

interface TotalEarningsQueryResult {
  asset: string;
  totalEarned: string;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);
  private readonly frontendUrl: string;
  private readonly commissionRate: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly balanceService: BalanceService,
    private readonly affiliateWalletService: AffiliateWalletService,
    private readonly usersService: UsersService,
    @InjectRepository(AffiliateCampaignEntity)
    private readonly campaignRepository: Repository<AffiliateCampaignEntity>,
    private readonly cryptoConverter: CryptoConverterService,
    private readonly notificationService: NotificationService,
  ) {
    this.commissionRate = affiliateConfig().commission;
    this.frontendUrl = affiliateConfig().frontendUrl;
  }

  private safeParseFloat(value: string | number | undefined, defaultValue: number = 0): number {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    const parsed = parseFloat(value.toString());
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  async createCampaign(userId: string, dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    const queryRunner = this.campaignRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock user row first to prevent race condition in campaign count check
      await queryRunner.manager
        .createQueryBuilder(UserEntity, 'user')
        .where('user.id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      const campaigns = await queryRunner.manager
        .createQueryBuilder(AffiliateCampaignEntity, 'campaign')
        .where('campaign.userId = :userId', { userId })
        .getMany();

      if (campaigns.length >= 3) {
        throw new BadRequestException(
          'Maximum 3 campaigns allowed. Please delete an existing campaign before creating a new one.',
        );
      }

      // Generate unique code if not provided
      // Use full UUID to avoid race condition with short codes (8 chars collision risk)
      const code = dto.code || `code-${randomUUID()}`;

      const campaign = queryRunner.manager.create(AffiliateCampaignEntity, {
        userId,
        name: dto.name,
        description: dto.description,
        code,
      });

      const saved = await queryRunner.manager.save(campaign);
      await queryRunner.commitTransaction();

      return this.mapCampaignToResponse(saved);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        throw new ConflictException(
          `Campaign code '${dto.code || 'generated'}' is already in use. Please choose a different code.`,
        );
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getCampaign(userId: string, campaignId: string): Promise<CampaignResponseDto> {
    if (!isUUID(campaignId)) {
      throw new BadRequestException('Invalid campaign ID format');
    }

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    return this.mapCampaignToResponse(campaign);
  }

  async deleteCampaign(userId: string, code: string): Promise<void> {
    const queryRunner = this.campaignRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Use functional index: LOWER(campaign.code) = :lowerCode (not LOWER(:code))
      const campaign = await queryRunner.manager
        .createQueryBuilder(AffiliateCampaignEntity, 'campaign')
        .where('campaign.userId = :userId', { userId })
        .andWhere('LOWER(campaign.code) = :lowerCode', { lowerCode: code.toLowerCase() })
        .getOne();

      if (!campaign) {
        throw new NotFoundException('Campaign not found');
      }

      // Check if campaign has referred users
      const referredUsersCount = await queryRunner.manager
        .createQueryBuilder(UserEntity, 'user')
        .where('user.affiliateCampaignId = :campaignId', { campaignId: campaign.id })
        .getCount();

      if (referredUsersCount > 0) {
        throw new BadRequestException(
          `Cannot delete campaign with ${referredUsersCount} referred user(s). ` +
            `Deleting would create orphaned records and break statistics.`,
        );
      }

      // Safe to delete - no referred users
      await queryRunner.manager.remove(campaign);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getUserCampaigns(
    userId: string,
    page: number = 1,
    limit: number = 5,
  ): Promise<{ campaigns: CampaignResponseDto[]; total: number }> {
    // Load campaigns for the user with pagination and sorting by creation date descending
    const skip = (page - 1) * limit;

    const [campaigns, total] = await this.campaignRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const campaignDtos = await Promise.all(
      campaigns.map(async (c) => {
        const baseDto = this.mapCampaignToResponse(c);
        const stats = await this.getCampaignStats(c.id);
        baseDto.totalReferrals = stats.totalReferrals;
        baseDto.totalDeposited = stats.totalDeposited;
        return baseDto;
      }),
    );

    return {
      campaigns: campaignDtos,
      total,
    };
  }

  // Resolve either a campaign UUID or a human-friendly code to the campaign ID
  public async resolveCampaignRefToId(ref?: string | null): Promise<string | null> {
    if (!ref) return null;
    if (isUUID(ref)) {
      const byId = await this.campaignRepository.findOne({ where: { id: ref } });
      return byId ? byId.id : null;
    }
    // Case-insensitive lookup for codes using functional index
    const byCode = await this.campaignRepository
      .createQueryBuilder('campaign')
      .where('LOWER(campaign.code) = :lowerCode', { lowerCode: ref.toLowerCase() })
      .getOne();
    return byCode ? byCode.id : null;
  }

  calculateCommission(depositAmount: string): BigNumber {
    const depositBN = new BigNumber(depositAmount);
    return depositBN.multipliedBy(this.commissionRate);
  }

  private async getCampaignStats(
    campaignId: string,
  ): Promise<{ totalReferrals: number; totalDeposited: string }> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(u.id)', 'totalReferrals')
      .addSelect('SUM(bs.deps)', 'totalDeps')
      .from(UserEntity, 'u')
      .leftJoin(BalanceStatisticEntity, 'bs', 'bs.userId = u.id')
      .where('u.affiliateCampaignId = :campaignId', { campaignId })
      .getRawOne<{ totalReferrals: string; totalDeps: string | null }>();

    const totalReferrals = result?.totalReferrals ? parseInt(result.totalReferrals, 10) : 0;
    const totalDeposited = result?.totalDeps
      ? (parseFloat(result.totalDeps) / 100).toFixed(2)
      : '0';

    return { totalReferrals, totalDeposited };
  }

  private mapCampaignToResponse(campaign: AffiliateCampaignEntity): CampaignResponseDto {
    const response = new CampaignResponseDto();
    response.id = campaign.id;
    response.userId = campaign.userId;
    response.name = campaign.name;
    response.description = campaign.description;
    response.code = campaign.code;
    // Convert totalCommission from cents to dollars
    response.totalCommission = (parseFloat(campaign.totalCommission) / 100).toString();
    response.totalReferrals = campaign.totalReferrals;
    response.createdAt = campaign.createdAt;
    response.updatedAt = campaign.updatedAt;

    // Generate referral link (prefer code when present)
    const ref = campaign.code || campaign.id;
    const url = new URL(this.frontendUrl);
    url.searchParams.set('c', ref);
    response.referralLink = url.toString();

    return response;
  }

  async getCampaignsUsers(
    userId: string,
    params: CampaignUsersParams,
  ): Promise<CampaignUsersResponseDto> {
    const { campaignId, page, limit, startDate } = params;
    const skip = (page - 1) * limit;

    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${campaignId} not found`);
    }

    // Query users who have this campaign as their affiliateCampaignId
    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select('user')
      .from(UserEntity, 'user')
      .where('user.affiliateCampaignId = :campaignId', { campaignId })
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [users, totalUsers] = await Promise.all([
      queryBuilder.getMany(),
      queryBuilder.getCount(),
    ]);

    // Get user IDs for balance and commission queries
    const userIds = users.map((user) => user.id);

    // Initialize response
    const response = new CampaignUsersResponseDto();
    response.campaignId = campaignId;
    response.campaignName = campaign.name;
    response.totalUsers = totalUsers;
    response.currentPage = Number(page);
    response.totalPages = Math.ceil(totalUsers / limit);
    response.pageSize = limit;
    response.totalCommission = '0';

    // If no users found, return empty response
    if (userIds.length === 0) {
      response.users = [];
      return response;
    }

    // Define date range for queries
    const fromDate = startDate || new Date(0); // If no startDate provided, use epoch time
    const toDate = new Date();

    // Get deposits for each user from AffiliateCommissionEntity
    const depositsQuery = this.dataSource
      .getRepository(AffiliateCommissionEntity)
      .createQueryBuilder('commission')
      .select('commission.referredUserId', 'userId')
      .addSelect('SUM(CAST(commission.depositAmountCents AS DECIMAL))', 'totalDeposits')
      .where('commission.campaignId = :campaignId', { campaignId })
      .andWhere('commission.referredUserId IN (:...userIds)', { userIds })
      .andWhere('commission.createdAt >= :fromDate', { fromDate })
      .andWhere('commission.createdAt <= :toDate', { toDate })
      .groupBy('commission.referredUserId');

    // Get commissions for each user from affiliate_earnings with asset info
    const commissionsResults = await this.dataSource.query(
      `SELECT ae."referredUserId" as "userId", ae.asset, SUM(CAST(ae.earned AS DECIMAL)) as "totalCommission"
       FROM affiliate.affiliate_earnings ae
       WHERE ae."referredUserId" = ANY($1)
       GROUP BY ae."referredUserId", ae.asset`,
      [userIds],
    );

    // Execute deposits query
    const depositsResults = await depositsQuery.getRawMany<{
      userId: string;
      totalDeposits: string;
    }>();

    // Create lookup maps for deposits and commissions
    const depositsMap = new Map(
      depositsResults.map((item) => [item.userId, item.totalDeposits || '0']),
    );
    const commissionsMap = new Map<string, number>();
    commissionsResults.forEach((item: EarningsQueryResult) => {
      const earnedCrypto = item.totalCommission || '0';
      const asset = item.asset as AssetTypeEnum;
      // Earned is in crypto, convert to USD cents
      const usdCents = this.cryptoConverter.toCents(this.safeParseFloat(earnedCrypto), asset);
      const currentTotal = commissionsMap.get(item.userId) || 0;
      // usdCents is already a string, parse and sum
      commissionsMap.set(item.userId, currentTotal + this.safeParseFloat(usdCents));
    });

    // Set total commission for the campaign
    let totalCampaignCommissionCents = 0;
    const allEarningsByAsset = await this.dataSource.query(
      `SELECT ae.asset, SUM(CAST(ae.earned AS DECIMAL)) as "totalEarned"
       FROM affiliate.affiliate_earnings ae
       WHERE ae."referredUserId" = ANY($1)
       GROUP BY ae.asset`,
      [userIds],
    );
    allEarningsByAsset.forEach((item: TotalEarningsQueryResult) => {
      const earnedCrypto = item.totalEarned || '0';
      const asset = item.asset as AssetTypeEnum;
      const usdCents = this.cryptoConverter.toCents(this.safeParseFloat(earnedCrypto), asset);
      // usdCents is already in cents, just accumulate
      totalCampaignCommissionCents += this.safeParseFloat(usdCents);
    });
    // Return as cents (not dollars)
    response.totalCommission = totalCampaignCommissionCents.toString();

    // Get wagered for each user within date range
    const reports = await this.balanceService.getUsersBalanceReport(userIds, fromDate, toDate);
    const wageredMap = new Map(reports.map((r) => [r.userId, r.totalWager || '0']));

    // Map users with their deposits, commissions, wagered and earnings
    response.users = users.map((user) => {
      const userTotalCommissionCents = commissionsMap.get(user.id) || 0;
      // Return as cents (not dollars)
      const userTotalCommissionStr = userTotalCommissionCents.toString();
      return {
        userId: user.id,
        username: user.username,
        registeredAt: user.createdAt,
        totalDeposits: depositsMap.get(user.id) || '0',
        totalCommission: userTotalCommissionStr,
        totalWagered: wageredMap.get(user.id) || '0',
        earnings: userTotalCommissionStr,
      };
    });

    return response;
  }

  async getAllReferredUsers(
    userId: string,
    limit: number,
    offset: number,
    campaignRef?: string,
    sortBy: ReferredUsersSortEnum = ReferredUsersSortEnum.CREATED_AT,
  ): Promise<ReferredUsersResponseDto> {
    let campaignIds: string[];

    if (campaignRef) {
      // Filter by specific campaign ID or code
      const resolvedCampaignId = await this.resolveCampaignRefToId(campaignRef);
      if (!resolvedCampaignId) {
        throw new NotFoundException(`Campaign with identifier ${campaignRef} not found`);
      }

      // Verify the campaign belongs to the current user
      const campaign = await this.campaignRepository.findOne({
        where: { id: resolvedCampaignId, userId },
        select: ['id'],
      });

      if (!campaign) {
        throw new NotFoundException(
          `Campaign with identifier ${campaignRef} not found or not owned by user`,
        );
      }

      campaignIds = [resolvedCampaignId];
    } else {
      // Get all campaigns for the current user
      const campaigns = await this.campaignRepository.find({
        where: { userId },
        select: ['id'],
      });

      if (campaigns.length === 0) {
        return {
          users: [],
          totalUsers: 0,
          totalEarnings: 0,
          offset,
          limit,
          hasMore: false,
        };
      }

      campaignIds = campaigns.map((c) => c.id);
    }

    // Get total count and users who have registered through any of these campaigns
    const queryBuilder = this.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where('user.affiliateCampaignId IN (:...campaignIds)', { campaignIds });

    // Get total count
    const totalUsers = await queryBuilder.getCount();

    if (totalUsers === 0) {
      return {
        users: [],
        totalUsers: 0,
        totalEarnings: 0,
        offset,
        limit,
        hasMore: false,
      };
    }

    // Apply database-level sorting and pagination based on sortBy field
    let users: UserEntity[];

    if (sortBy === ReferredUsersSortEnum.CREATED_AT) {
      // Simple createdAt sorting with pagination
      users = await queryBuilder
        .orderBy('user.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany();
    } else if (sortBy === ReferredUsersSortEnum.TOTAL_WAGERED) {
      // Join with balance_statistics ONLY for sorting (already in USD, fast)
      // Actual totalWagered values in response come from affiliate_earnings.wagered (more accurate)
      const result = await this.dataSource.query(
        `SELECT u.* 
         FROM users.users u
         LEFT JOIN balance.balance_statistics bs ON u.id = bs."userId"
         WHERE u."affiliateCampaignId" = ANY($1)
         ORDER BY COALESCE(bs.bets, 0) DESC
         LIMIT $2 OFFSET $3`,
        [campaignIds, limit, offset],
      );

      // Map raw results to UserEntity
      users = result.map((row: any) => {
        const user = new UserEntity();
        Object.assign(user, row);
        return user;
      });
    } else {
      // Fallback to createdAt
      users = await queryBuilder
        .orderBy('user.createdAt', 'DESC')
        .skip(offset)
        .take(limit)
        .getMany();
    }

    if (users.length === 0) {
      return {
        users: [],
        totalUsers,
        totalEarnings: 0,
        offset,
        limit,
        hasMore: false,
      };
    }

    const userIds = users.map((user) => user.id);
    return this.buildReferredUsersResponse(users, userIds, totalUsers, userId, offset, limit);
  }

  private async buildReferredUsersResponse(
    users: UserEntity[],
    userIds: string[],
    totalUsers: number,
    affiliateId: string,
    offset: number,
    limit: number,
  ): Promise<ReferredUsersResponseDto> {
    // Get earnings for each referred user from affiliate_earnings table using raw SQL
    const commissionsResults = await this.dataSource.query(
      `SELECT ae."referredUserId" as "userId", ae.asset, SUM(CAST(ae.earned AS DECIMAL)) as "totalCommission"
       FROM affiliate.affiliate_earnings ae
       WHERE ae."affiliateId" = $1 AND ae."referredUserId" = ANY($2)
       GROUP BY ae."referredUserId", ae.asset`,
      [affiliateId, userIds],
    );

    // Create lookup map for commissions/earnings - CONVERT CRYPTO TO USD CENTS
    const commissionsMap = new Map<string, number>();
    commissionsResults.forEach((item: EarningsQueryResult) => {
      const earnedCrypto = item.totalCommission || '0';
      const asset = item.asset as AssetTypeEnum;
      // Earned is in crypto, convert to USD cents
      const usdCents = this.cryptoConverter.toCents(this.safeParseFloat(earnedCrypto), asset);
      const currentTotal = commissionsMap.get(item.userId) || 0;
      commissionsMap.set(item.userId, currentTotal + this.safeParseFloat(usdCents));
    });

    // Get wagered amounts for each user from affiliate_earnings (crypto amounts, need conversion)
    // NOTE: We use affiliate_earnings.wagered for accurate data (excludes cancelled sportsbook bets)
    // balance_statistics is only used for sorting performance (already in USD)
    const wageredResults = await this.dataSource.query(
      `SELECT ae."referredUserId" as "userId", ae.asset, SUM(CAST(ae.wagered AS DECIMAL)) as "totalWagered"
       FROM affiliate.affiliate_earnings ae
       WHERE ae."affiliateId" = $1 AND ae."referredUserId" = ANY($2)
       GROUP BY ae."referredUserId", ae.asset`,
      [affiliateId, userIds],
    );

    // Create lookup map for wagered amounts - CONVERT CRYPTO TO USD CENTS, then to dollars
    const wageredMap = new Map<string, number>();
    wageredResults.forEach((item: any) => {
      const wageredCrypto = item.totalWagered || '0';
      const asset = item.asset as AssetTypeEnum;
      const usdCents = this.cryptoConverter.toCents(this.safeParseFloat(wageredCrypto), asset);
      const currentTotal = wageredMap.get(item.userId) || 0;
      const wagerInDollars = this.safeParseFloat(usdCents) / 100;
      wageredMap.set(item.userId, currentTotal + Math.round(wagerInDollars * 100) / 100);
    });

    // Get public user profiles using UsersService
    const publicUserProfiles = await this.usersService.getPublicUserProfiles(userIds);

    // Create lookup map for public profiles
    const profilesMap = new Map(publicUserProfiles.map((profile) => [profile.userId, profile]));

    // Get campaign information for each user
    const userCampaignIds = [
      ...new Set(users.map((user) => user.affiliateCampaignId).filter(Boolean)),
    ];
    const campaigns = await this.campaignRepository.find({
      where: { id: In(userCampaignIds) },
      select: ['id', 'code', 'createdAt'],
    });

    // Create lookup map for campaigns
    const campaignsMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));

    // Get all earnings by asset for total conversion
    const allEarningsByAsset = await this.dataSource.query(
      `SELECT ae.asset, SUM(CAST(ae.earned AS DECIMAL)) as "totalEarned"
       FROM affiliate.affiliate_earnings ae
       WHERE ae."affiliateId" = $1
       GROUP BY ae.asset`,
      [affiliateId],
    );

    // Convert total earnings from all crypto assets to USD cents
    let totalEarningsCents = 0;
    allEarningsByAsset.forEach((item: TotalEarningsQueryResult) => {
      const earnedCrypto = item.totalEarned || '0';
      const asset = item.asset as AssetTypeEnum;
      const usdCents = this.cryptoConverter.toCents(this.safeParseFloat(earnedCrypto), asset);
      totalEarningsCents += this.safeParseFloat(usdCents);
    });

    // Map users to ReferredUserProfileDto format
    const referredUsers = users.map((user) => {
      const publicProfile = profilesMap.get(user.id);
      const userEarningsCents = commissionsMap.get(user.id) || 0;
      const userWageredDollars = wageredMap.get(user.id) || 0;

      // Get campaign information
      const campaign = campaignsMap.get(user.affiliateCampaignId!);
      const campaignInfo = campaign
        ? {
            campaignId: campaign.id,
            code: campaign.code || undefined,
            createdAt: campaign.createdAt,
          }
        : undefined;

      if (!publicProfile) {
        // Fallback if profile not found (shouldn't happen normally)
        return {
          userId: user.id,
          userName: user.username || 'Unknown',
          createdAt: user.createdAt,
          avatarUrl: undefined,
          vipLevel: { level: 0, name: 'Bronze I', imageUrl: '', percent: 0 },
          hideStatistics: false,
          hideRaceStatistics: false,
          totalEarnings: Math.round(userEarningsCents) / 100,
          totalWagered: userWageredDollars,
          campaign: campaignInfo,
        };
      }

      // Remove statistics field and use wagered from affiliate_earnings
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { statistics: _statistics, ...profileWithoutStats } = publicProfile;

      return {
        ...profileWithoutStats,
        totalEarnings: Math.round(userEarningsCents) / 100,
        totalWagered: userWageredDollars,
        campaign: campaignInfo,
      };
    });

    return {
      users: referredUsers,
      totalUsers,
      totalEarnings: Math.round(totalEarningsCents) / 100,
      offset,
      limit,
      hasMore: offset + users.length < totalUsers,
    };
  }

  async claimAllCommissions(userId: string): Promise<AffiliateClaimResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const operationId = randomUUID();

      const walletRepo = queryRunner.manager.getRepository(AffiliateWalletEntity);
      const allWallets = await walletRepo
        .createQueryBuilder('wallet')
        .where('wallet.userId = :userId', { userId })
        .setLock('pessimistic_write')
        .getMany();

      const walletsWithBalance = allWallets.filter((w) =>
        new BigNumber(w.balance).isGreaterThan(0),
      );

      if (walletsWithBalance.length === 0) {
        throw new BadRequestException('No commissions available to claim');
      }

      // Calculate total commission value in USD
      const totalCommissionUsd = walletsWithBalance.reduce((sum, wallet) => {
        const cents = this.cryptoConverter.toCents(wallet.balance, wallet.asset);
        return sum.plus(cents);
      }, new BigNumber(0));

      const totalCommissionUsdValue = totalCommissionUsd.dividedBy(100);

      // Minimum claim amount: $10
      if (totalCommissionUsdValue.isLessThan(10)) {
        throw new BadRequestException(
          `Minimum claim amount is $10. Current balance: $${totalCommissionUsdValue.toFixed(2)}`,
        );
      }

      const transferred: Record<string, string> = {};

      for (const wallet of walletsWithBalance) {
        const amount = new BigNumber(wallet.balance);

        const balanceOperationId = randomUUID();

        // Withdraw from affiliate wallet (CLAIM operation)
        await this.affiliateWalletService.updateBalance(
          {
            userId,
            asset: wallet.asset,
            amount,
            operation: AffiliateCommissionOperationEnum.CLAIM,
            balanceOperationId,
            metadata: {
              claimType: 'full',
              claimRequestId: operationId,
            },
          },
          queryRunner,
        );

        // Deposit to private wallet
        await this.balanceService.updateBalance(
          {
            operation: BalanceOperationEnum.AFFILIATE_CLAIM,
            operationId: balanceOperationId,
            userId,
            amount,
            asset: wallet.asset,
            description: `Affiliate commission claim`,
            metadata: {
              claimRequestId: operationId,
              asset: wallet.asset,
            },
          },
          queryRunner,
        );

        transferred[wallet.asset] = amount.toString();
      }

      await queryRunner.commitTransaction();

      const totalUsd = Object.entries(transferred).reduce((sum, [asset, amount]) => {
        const cents = this.cryptoConverter.toCents(amount, asset as AssetTypeEnum);
        return sum.plus(cents);
      }, new BigNumber(0));

      this.notificationService
        .sendToUserAndSave(userId, {
          type: 'affiliate_claim',
          title: 'Commission Claimed',
          message: `Successfully claimed $${totalUsd.dividedBy(100).toFixed(2)} commission`,
          data: {
            transferred,
            totalTransferred: Object.keys(transferred).length,
            totalUsd: totalUsd.dividedBy(100).toFixed(2),
          },
        })
        .catch((error) => {
          this.logger.error('Failed to send claim notification', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return {
        transferred,
        totalTransferred: Object.keys(transferred).length,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async getCommissionsDetail(userId: string): Promise<AffiliateCommissionDetailDto[]> {
    const walletRepo = this.dataSource.getRepository(AffiliateWalletEntity);
    const wallets = await walletRepo.find({ where: { userId } });

    return wallets.map((wallet) => ({
      asset: wallet.asset,
      commission: wallet.totalEarned,
      claimed: wallet.totalClaimed,
      claimable: wallet.balance,
    }));
  }

  private async calculateCampaignsAggregates(
    userId: string,
  ): Promise<{ totalUsers: number; totalWagered: number; totalDeposited: number }> {
    const userCampaigns = await this.campaignRepository.find({
      where: { userId },
    });

    if (userCampaigns.length === 0) {
      return { totalUsers: 0, totalWagered: 0, totalDeposited: 0 };
    }

    const campaignIds = userCampaigns.map((c) => c.id);

    // Count referral users
    const totalUsers = await this.dataSource
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where('user.affiliateCampaignId IN (:...campaignIds)', { campaignIds })
      .getCount();

    // Get commissions totals
    const totals = await this.dataSource
      .getRepository(AffiliateCommissionEntity)
      .createQueryBuilder('commission')
      .select('COALESCE(SUM(CAST(commission.depositAmountCents AS DECIMAL)), 0)', 'totalDeposited')
      .where('commission.campaignId IN (:...campaignIds)', { campaignIds })
      .getRawOne<{ totalDeposited: string }>();

    const totalDepositedCents = parseFloat(totals?.totalDeposited || '0');

    // Get wagered from affiliate_earnings per asset
    // NOTE: We use affiliate_earnings.wagered instead of balance_statistics because:
    // - Sportsbook bets can be cancelled/refunded after placement
    // - balance_statistics includes cancelled bets, which shouldn't count for affiliate commissions
    // - affiliate_earnings.wagered only tracks bets that actually generated commissions
    // Trade-off: Slower (convert each asset to USD) vs more accurate data
    // Acceptable because we limit the number of campaigns per user (max 3)
    const wageredResult = await this.dataSource
      .getRepository(AffiliateEarningsEntity)
      .createQueryBuilder('earnings')
      .select('earnings.asset', 'asset')
      .addSelect('COALESCE(SUM(CAST(earnings.wagered AS DECIMAL)), 0)', 'totalWagered')
      .where('earnings.affiliateId = :userId', { userId })
      .groupBy('earnings.asset')
      .getRawMany<{ asset: string; totalWagered: string }>();

    // Convert each asset's wagered amount to USD cents and sum
    let totalWageredCents = 0;
    for (const row of wageredResult) {
      const wageredInCents = this.cryptoConverter.toCents(
        row.totalWagered,
        row.asset as AssetTypeEnum,
      );
      totalWageredCents += parseFloat(wageredInCents);
    }

    return {
      totalUsers,
      totalWagered: Math.round(totalWageredCents),
      totalDeposited: Math.round(totalDepositedCents),
    };
  }

  async getStatistics(userId: string): Promise<AffiliateStatisticsResponseDto> {
    // 1. Get campaigns aggregate data
    const aggregates = await this.calculateCampaignsAggregates(userId);

    // 2. Get commissions detail per asset
    const commissions = await this.getCommissionsDetail(userId);

    // 3. Calculate USD totals from commissions
    let totalClaimedUsd = new BigNumber(0);
    let totalAvailableUsd = new BigNumber(0);

    for (const commission of commissions) {
      const claimedCents = this.cryptoConverter.toCents(
        commission.claimed,
        commission.asset as AssetTypeEnum,
      );
      totalClaimedUsd = totalClaimedUsd.plus(claimedCents);

      const claimableCents = this.cryptoConverter.toCents(
        commission.claimable,
        commission.asset as AssetTypeEnum,
      );
      totalAvailableUsd = totalAvailableUsd.plus(claimableCents);
    }

    // 4. Return combined data
    return {
      totalReferrals: aggregates.totalUsers,
      totalWageredUsd: (aggregates.totalWagered / 100).toFixed(2),
      totalDepositedUsd: (aggregates.totalDeposited / 100).toFixed(2),
      totalClaimedUsd: totalClaimedUsd.dividedBy(100).toFixed(2),
      totalAvailableUsd: totalAvailableUsd.dividedBy(100).toFixed(2),
      commissions,
    };
  }
}
