import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SelfExclusionGuard } from '../../common/guards/self-exclusion.guard';
import { WeeklyReloadBonusDto } from '../dto/weekly-reload-bonus.dto';
import { WeeklyReloadListResponseDto } from '../dto/weekly-reload-list-response.dto';
import { WeeklyReloadBonusService } from '../services/weekly-reload-bonus.service';

@ApiTags('Bonus Weekly Reload')
@Controller('weekly-reload')
@UseGuards(JwtAuthGuard, SelfExclusionGuard)
@ApiBearerAuth()
export class WeeklyReloadController {
  constructor(private readonly weeklyReloadBonusService: WeeklyReloadBonusService) {}

  @Get('bonuses')
  @ApiOperation({ summary: 'Get paginated weekly reload bonuses for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'Paginated weekly reload bonuses',
    type: WeeklyReloadListResponseDto,
  })
  async getMyWeeklyReloadBonuses(
    @Req() req: Request & { user: { id: string } },
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<WeeklyReloadListResponseDto> {
    const userId = req.user.id;

    const [data, total] = await Promise.all([
      this.weeklyReloadBonusService.getWeeklyReloadBonuses(userId, page, limit),
      this.weeklyReloadBonusService.countWeeklyReloadBonuses(userId),
    ]);

    return { data, page, limit, total };
  }

  @Post('claim/:bonusId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Claim a weekly reload bonus' })
  @ApiParam({
    name: 'bonusId',
    type: String,
    description: 'ID of the weekly reload bonus to claim',
  })
  @ApiResponse({
    status: 201,
    description: 'Claim result',
    type: WeeklyReloadBonusDto,
  })
  async claimWeeklyReloadBonus(
    @Req() req: Request & { user: { id: string } },
    @Param('bonusId', ParseUUIDPipe) bonusId: string,
  ): Promise<WeeklyReloadBonusDto> {
    const userId = req.user.id;
    const bonus = await this.weeklyReloadBonusService.claimWeeklyReloadBonus(userId, bonusId);

    return {
      id: bonus.id,
      amount: (parseFloat(bonus.amount) / 100).toFixed(2), // Convert cents to dollars
      status: bonus.status,
      description: bonus.description || `Weekly reload bonus ${bonus.id}`,
      activateAt: bonus.activateAt,
      expiredAt: bonus.expiredAt,
      claimedAt: bonus.claimedAt,
      metadata: bonus.metadata,
    };
  }
}
