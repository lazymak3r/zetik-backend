import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AdminAccessGuard } from '../bonus/guards/admin-access.guard';
import { AffiliateAdminService } from './affiliate-admin.service';
import { CampaignIdDto } from './dto/campaign-id.dto';

@ApiExcludeController()
@Controller('affiliate-admin')
@UseGuards(AdminAccessGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AffiliateAdminController {
  constructor(private readonly affiliateAdminService: AffiliateAdminService) {}

  @Delete('campaigns/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCampaign(
    @Param() params: CampaignIdDto,
  ): Promise<{ success: boolean; message: string; cacheInvalidatedCount: number }> {
    return this.affiliateAdminService.deleteCampaign(params.id);
  }
}
