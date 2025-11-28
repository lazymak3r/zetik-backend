import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AffiliateCampaignEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { AffiliateCommissionService } from '../common/affiliate/affiliate-commission.service';
import { RedisService } from '../common/services/redis.service';

@Injectable()
export class AffiliateAdminService {
  private readonly logger = new Logger(AffiliateAdminService.name);
  private readonly CACHE_INVALIDATION_CHANNEL = 'affiliate:cache:invalidate';

  constructor(
    @InjectRepository(AffiliateCampaignEntity)
    private readonly campaignRepository: Repository<AffiliateCampaignEntity>,
    private readonly affiliateCommissionService: AffiliateCommissionService,
    private readonly redisService: RedisService,
  ) {}

  async deleteCampaign(
    campaignId: string,
  ): Promise<{ success: boolean; message: string; cacheInvalidatedCount: number }> {
    // Find campaign
    const campaign = await this.campaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }

    // Check if campaign has any referrals
    const referralCount = await this.checkReferralCount(campaign.code);
    if (referralCount > 0) {
      throw new BadRequestException(
        `Cannot delete campaign with ${referralCount} existing referral(s)`,
      );
    }

    // Delete campaign
    await this.campaignRepository.delete(campaignId);

    // Invalidate cache locally for this instance
    const localCacheInvalidatedCount =
      this.affiliateCommissionService.invalidateCacheByCompaignCode(campaign.code);

    // Broadcast cache invalidation to all backend instances via Redis pub/sub
    try {
      const message = JSON.stringify({
        campaignCode: campaign.code,
        campaignId: campaignId,
        timestamp: Date.now(),
      });
      const result = await this.redisService
        .getClient()
        .publish(this.CACHE_INVALIDATION_CHANNEL, message);
      this.logger.log(
        `Published cache invalidation event for campaign ${campaign.code}. Subscribers: ${result}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish cache invalidation event for campaign ${campaign.code}`,
        error instanceof Error ? error.message : String(error),
      );
      // Don't fail the deletion if Redis pub/sub fails - local cache is already invalidated
    }

    this.logger.log(
      `Deleted campaign ${campaign.code} (ID: ${campaignId}). Local cache invalidated: ${localCacheInvalidatedCount} entries.`,
    );

    return {
      success: true,
      message: 'Campaign deleted successfully',
      cacheInvalidatedCount: localCacheInvalidatedCount,
    };
  }

  private async checkReferralCount(campaignCode: string): Promise<number> {
    const result = await this.campaignRepository.query(
      `SELECT COUNT(DISTINCT ae."referredUserId") as count
       FROM affiliate.affiliate_earnings ae
       WHERE ae."campaignCode" = $1`,
      [campaignCode],
    );

    return parseInt(result[0]?.count || '0', 10);
  }
}
