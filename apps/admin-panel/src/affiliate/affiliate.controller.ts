import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AffiliateService,
  ICampaignDetailsResponse,
  ICampaignReferralsResponse,
  IPaginatedCampaignsResponse,
} from './affiliate.service';
import { CampaignIdDto } from './dto/campaign-id.dto';
import { GetCampaignsQueryDto } from './dto/get-campaigns-query.dto';
import { GetReferralsQueryDto } from './dto/get-referrals-query.dto';

@ApiTags('affiliate')
@Controller('affiliate')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UseInterceptors(AuditLogInterceptor)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get('campaigns')
  @ApiOperation({ summary: 'Get all affiliate campaigns with filtering options' })
  @ApiResponse({
    status: 200,
    description: 'List of affiliate campaigns',
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW_AFFILIATE_CAMPAIGNS, resource: 'campaigns' })
  async getCampaigns(@Query() query: GetCampaignsQueryDto): Promise<IPaginatedCampaignsResponse> {
    return this.affiliateService.findAll(query);
  }

  @Get('campaigns/:id')
  @ApiOperation({ summary: 'Get affiliate campaign details by ID' })
  @ApiResponse({
    status: 200,
    description: 'Campaign details',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW_AFFILIATE_CAMPAIGN_DETAILS, resource: 'campaigns' })
  async getCampaignDetails(@Param() params: CampaignIdDto): Promise<ICampaignDetailsResponse> {
    const campaign = await this.affiliateService.getCampaignDetails(params.id);
    if (!campaign) {
      throw new NotFoundException(`Campaign ${params.id} not found`);
    }
    return campaign;
  }

  @Get('campaigns/:id/referrals')
  @ApiOperation({ summary: 'Get campaign referred users with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Campaign referred users',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  async getCampaignReferrals(
    @Param() params: CampaignIdDto,
    @Query() query: GetReferralsQueryDto,
  ): Promise<ICampaignReferralsResponse> {
    const referrals = await this.affiliateService.getCampaignReferrals(
      params.id,
      query.page,
      query.limit,
    );
    if (!referrals) {
      throw new NotFoundException(`Campaign ${params.id} not found`);
    }
    return referrals;
  }

  @Delete('campaigns/:id')
  @ApiOperation({ summary: 'Delete affiliate campaign (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Campaign deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete campaign with existing referrals',
  })
  @ApiResponse({
    status: 404,
    description: 'Campaign not found',
  })
  @AuditLog({ action: AdminActionTypeEnum.DELETE_AFFILIATE_CAMPAIGN, resource: 'campaigns' })
  async deleteCampaign(@Param() params: CampaignIdDto): Promise<{ message: string }> {
    const result = await this.affiliateService.deleteCampaign(params.id);

    if (!result.success) {
      if (result.message.includes('not found')) {
        throw new NotFoundException(result.message);
      }
      throw new BadRequestException(result.message);
    }

    return { message: result.message };
  }
}
