import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { PAGE_LIMIT } from '../common/constants/constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RedisService } from '../common/services/redis.service';
import { AffiliateService } from './affiliate.service';
import {
  AffiliateClaimResponseDto,
  AffiliateStatisticsResponseDto,
} from './dto/affiliate-commissions.dto';
import { CampaignResponseDto } from './dto/campaign-response.dto';
import { CampaignUsersResponseDto } from './dto/campaign-users-response.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { DeleteCampaignDto } from './dto/delete-campaign.dto';
import { GetUserCampaignsResponseDto } from './dto/get-user-campaigns-response.dto';
import { ReferredUsersResponseDto, ReferredUsersSortEnum } from './dto/referred-user-profile.dto';

// Referred users pagination limits - kept low due to expensive calculations
// (earning conversions, balance reports, user profiles aggregation)
const REFERRED_USERS_DEFAULT_LIMIT = 5;
const REFERRED_USERS_MAX_LIMIT = 20;

@ApiTags('affiliate')
@Controller('affiliate')
export class AffiliateController {
  private readonly CAMPAIGNS_CACHE_TTL = 300;

  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly redisService: RedisService,
  ) {}

  private getCampaignsCacheKey(userId: string, page: number, limit: number): string {
    return `affiliate:campaigns:${userId}:${page}:${limit}`;
  }

  @Post('campaigns')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new affiliate campaign' })
  @ApiResponse({
    status: 201,
    description: 'Campaign created successfully',
    type: CampaignResponseDto,
  })
  async createCampaign(
    @CurrentUser() user: UserEntity,
    @Body() createCampaignDto: CreateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.affiliateService.createCampaign(user.id, createCampaignDto);
  }

  @Get('campaigns')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated campaigns for the current user, sorted by newest' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number', example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of campaigns',
    type: GetUserCampaignsResponseDto,
    schema: {
      example: {
        campaigns: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            userId: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Summer Promotion',
            description: 'Special promotion for summer 2023',
            code: 'SUMMER2025',
            totalCommission: '1250.50',
            totalReferrals: 25,
            totalDeposited: '5000.00',
            referralLink: 'https://example.com/?c=TEST_2025',
            createdAt: '2023-05-12T12:00:00Z',
            updatedAt: '2023-05-12T12:30:00Z',
          },
        ],
      },
    },
  })
  async getUserCampaigns(
    @CurrentUser() user: UserEntity,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<GetUserCampaignsResponseDto> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 5;
    const cacheKey = this.getCampaignsCacheKey(user.id, pageNum, limitNum);

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Continue with DB query if cache fails
    }

    const result = await this.affiliateService.getUserCampaigns(user.id, pageNum, limitNum);

    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), this.CAMPAIGNS_CACHE_TTL);
    } catch {
      // Silent fail for cache writes
    }

    return result;
  }

  @Delete('campaigns')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete affiliate campaign by code' })
  @ApiResponse({
    status: 204,
    description: 'Campaign deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  async deleteCampaign(
    @CurrentUser() user: UserEntity,
    @Body() deleteCampaignDto: DeleteCampaignDto,
  ): Promise<void> {
    return this.affiliateService.deleteCampaign(user.id, deleteCampaignDto.code);
  }

  @Get('campaigns/users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get users for campaigns' })
  @ApiResponse({
    status: 200,
    description: 'Campaign users details',
    type: CampaignUsersResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  async getCampaignUsers(
    @CurrentUser() user: UserEntity,
    @Query('campaignId') campaignId: string,
    @Query('page') page: number = 1,
  ): Promise<CampaignUsersResponseDto> {
    return this.affiliateService.getCampaignsUsers(user.id, {
      campaignId,
      page,
      limit: PAGE_LIMIT,
    });
  }

  @Get('referred-users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get all users registered through referral campaigns of the current user with pagination, optional campaign filtering, and sorting',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `Number of items to return per page. Default: ${REFERRED_USERS_DEFAULT_LIMIT}, Max: ${REFERRED_USERS_MAX_LIMIT}. Lower limits recommended due to expensive calculations (earning conversions, balance reports, profile aggregation).`,
    example: REFERRED_USERS_DEFAULT_LIMIT,
    minimum: 1,
    maximum: REFERRED_USERS_MAX_LIMIT,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Number of items to skip for pagination',
    example: 0,
    minimum: 0,
  })
  @ApiQuery({
    name: 'campaignId',
    required: false,
    type: String,
    description: 'Filter results by specific campaign ID or campaign code',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ReferredUsersSortEnum,
    description: 'Sort users by specified field in descending order',
    example: ReferredUsersSortEnum.CREATED_AT,
  })
  @ApiResponse({
    status: 200,
    description: 'List of all referred users with their profile and earnings information',
    type: ReferredUsersResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  async getAllReferredUsers(
    @CurrentUser() user: UserEntity,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('campaignId') campaignId?: string,
    @Query('sortBy') sortBy?: ReferredUsersSortEnum,
  ): Promise<ReferredUsersResponseDto> {
    const limitNum = limit ? parseInt(limit, 10) : REFERRED_USERS_DEFAULT_LIMIT;
    const parsedLimit = Math.min(Math.max(limitNum, 1), REFERRED_USERS_MAX_LIMIT);
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const parsedOffset = Math.max(offsetNum, 0);
    const sortByField = sortBy || ReferredUsersSortEnum.CREATED_AT;
    return this.affiliateService.getAllReferredUsers(
      user.id,
      parsedLimit,
      parsedOffset,
      campaignId && String(campaignId).trim(),
      sortByField,
    );
  }

  @Post('claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Claim all earned commissions to private wallet',
    description:
      "Transfers all available affiliate commissions to the user's private wallet. Minimum claim amount is $2 USD.",
  })
  @ApiResponse({
    status: 200,
    description: 'Commissions transferred successfully',
    type: AffiliateClaimResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No commissions available to claim or total amount is less than $10 USD',
  })
  async claimCommissions(@CurrentUser() user: UserEntity): Promise<AffiliateClaimResponseDto> {
    return this.affiliateService.claimAllCommissions(user.id);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get affiliate commission statistics' })
  @ApiResponse({
    status: 200,
    description: 'Affiliate statistics',
    type: AffiliateStatisticsResponseDto,
  })
  async getStatistics(@CurrentUser() user: UserEntity): Promise<AffiliateStatisticsResponseDto> {
    return this.affiliateService.getStatistics(user.id);
  }
}
