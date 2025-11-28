import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminEntity } from '@zetik/shared-entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { GetVipTransfersQueryDto } from './dto/get-vip-transfers-query.dto';
import { UpdateVipTransferNoteDto } from './dto/update-vip-transfer-note.dto';
import { UpdateVipTransferTagDto } from './dto/update-vip-transfer-tag.dto';
import { VipTransfersService } from './vip-transfers.service';

@ApiTags('VIP Transfers')
@Controller('vip-transfers')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VipTransfersController {
  constructor(private readonly vipTransfersService: VipTransfersService) {}

  @Get()
  @ApiOperation({ summary: 'Get VIP transfer submissions with filters' })
  @ApiResponse({ status: 200, description: 'Returns list of VIP transfer submissions' })
  async getVipTransfers(@Query() query: GetVipTransfersQueryDto) {
    return await this.vipTransfersService.findAll(query);
  }

  @Patch(':id/tag')
  @ApiOperation({ summary: 'Update VIP transfer submission tag' })
  @ApiResponse({ status: 200, description: 'Tag updated successfully' })
  async updateTag(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminEntity,
    @Body() dto: UpdateVipTransferTagDto,
  ) {
    return await this.vipTransfersService.updateTag(id, admin.id, dto);
  }

  @Patch(':id/note')
  @ApiOperation({ summary: 'Update VIP transfer submission custom note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  async updateNote(
    @Param('id') id: string,
    @CurrentAdmin() admin: AdminEntity,
    @Body() dto: UpdateVipTransferNoteDto,
  ) {
    return await this.vipTransfersService.updateNote(id, admin.id, dto);
  }
}
