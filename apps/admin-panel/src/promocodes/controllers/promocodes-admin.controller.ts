import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum, AdminEntity } from '@zetik/shared-entities';
import { AuditLog, CurrentAdmin } from '../../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreatePromocodeDto } from '../dto/create-promocode.dto';
import {
  PromocodeAdminResponseDto,
  PromocodeAuditResponseDto,
  PromocodeClaimDto,
} from '../dto/promocode-admin-response.dto';
import { PromocodeListQueryDto } from '../dto/promocode-list-query.dto';
import { UpdatePromocodeDto } from '../dto/update-promocode.dto';
import { PromocodesAdminService } from '../services/promocodes-admin.service';

@ApiTags('admin-promocodes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('promocodes')
export class PromocodesAdminController {
  constructor(private readonly promocodesAdminService: PromocodesAdminService) {}

  @Post()
  @AuditLog({ action: AdminActionTypeEnum.CREATE, resource: 'promocodes' })
  @ApiOperation({ summary: 'Create a new promocode' })
  @ApiResponse({
    status: 201,
    description: 'Promocode created successfully',
    type: PromocodeAdminResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid promocode data',
  })
  async createPromocode(
    @CurrentAdmin() admin: AdminEntity,
    @Body() dto: CreatePromocodeDto,
  ): Promise<PromocodeAdminResponseDto> {
    return this.promocodesAdminService.createPromocode(admin.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get list of promocodes' })
  @ApiResponse({
    status: 200,
    description: 'List of promocodes retrieved successfully',
  })
  async getPromocodes(
    @Query() query: PromocodeListQueryDto,
  ): Promise<{ data: PromocodeAdminResponseDto[]; total: number }> {
    return this.promocodesAdminService.getPromocodes(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get promocode details' })
  @ApiResponse({
    status: 200,
    description: 'Promocode details retrieved successfully',
    type: PromocodeAdminResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Promocode not found',
  })
  async getPromocodeDetails(@Param('id') id: string): Promise<PromocodeAdminResponseDto> {
    return this.promocodesAdminService.getPromocodeDetails(id);
  }

  @Patch(':id')
  @AuditLog({ action: AdminActionTypeEnum.UPDATE, resource: 'promocodes' })
  @ApiOperation({ summary: 'Update promocode (status, end date, note)' })
  @ApiResponse({
    status: 200,
    description: 'Promocode updated successfully',
    type: PromocodeAdminResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Promocode not found',
  })
  async updatePromocode(
    @CurrentAdmin() admin: AdminEntity,
    @Param('id') id: string,
    @Body() dto: UpdatePromocodeDto,
  ): Promise<PromocodeAdminResponseDto> {
    return this.promocodesAdminService.updatePromocode(admin.id, id, dto);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get promocode audit history' })
  @ApiResponse({
    status: 200,
    description: 'Promocode history retrieved successfully',
    type: [PromocodeAuditResponseDto],
  })
  @ApiResponse({
    status: 404,
    description: 'Promocode not found',
  })
  async getPromocodeHistory(@Param('id') id: string): Promise<PromocodeAuditResponseDto[]> {
    return this.promocodesAdminService.getPromocodeHistory(id);
  }

  @Get(':id/claims')
  @ApiOperation({ summary: 'Get promocode claims history' })
  @ApiResponse({
    status: 200,
    description: 'Promocode claims history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Promocode not found',
  })
  async getPromocodeClaims(@Param('id') id: string): Promise<PromocodeClaimDto[]> {
    return await this.promocodesAdminService.getPromocodeClaims(id);
  }
}
