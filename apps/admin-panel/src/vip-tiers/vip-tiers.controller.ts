import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UpdateVipTierDto } from './dto/update-vip-tier.dto';
import { VipTierResponseDto } from './dto/vip-tier-response.dto';
import { VipTiersService } from './vip-tiers.service';

@ApiTags('VIP Tiers')
@ApiBearerAuth()
@Controller('vip-tiers')
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class VipTiersController {
  constructor(private readonly vipTiersService: VipTiersService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all VIP tiers' })
  @ApiResponse({ type: [VipTierResponseDto] })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'vip-tiers',
    getDetails: () => ({ action: 'list-vip-tiers' }),
  })
  async getAllTiers(): Promise<VipTierResponseDto[]> {
    return this.vipTiersService.findAllTiers();
  }

  @Put(':level')
  @ApiOperation({ summary: 'Update VIP tier' })
  @ApiResponse({ type: VipTierResponseDto })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'vip-tiers',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => ({ dto: args[1] }),
  })
  async updateTier(
    @Param('level') level: number,
    @Body() dto: UpdateVipTierDto,
    @CurrentAdmin('id') adminId: string,
  ): Promise<VipTierResponseDto> {
    return this.vipTiersService.updateTier(level, dto, adminId);
  }

  @Post('cancel-bonus/:bonusId')
  @ApiOperation({ summary: 'Cancel pending bonus (example endpoint)' })
  @ApiResponse({
    schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' } } },
  })
  @AuditLog({
    action: AdminActionTypeEnum.DELETE,
    resource: 'bonus',
    getResourceId: (args) => args[0] as string,
    getDetails: () => ({ action: 'cancel-bonus' }),
  })
  async cancelBonus(
    @Param('bonusId') bonusId: string,
    @CurrentAdmin('id') adminId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.vipTiersService.cancelBonus(bonusId, adminId);
  }
}
