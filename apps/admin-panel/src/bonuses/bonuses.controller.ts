import { Body, Controller, Get, Logger, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BonusesService } from './bonuses.service';
import { ActivateWeeklyReloadDto } from './dto/activate-weekly-reload.dto';
import { CalculateWeeklyReloadDto } from './dto/calculate-weekly-reload.dto';
import { CancelBonusesDto } from './dto/cancel-bonuses.dto';
import { GetBonusesFilterDto } from './dto/get-bonuses-filter.dto';
import { UpdateWeeklyRacePrizesInput } from './dto/update-weekly-race-prizes.input';
import { WeeklyReloadActivationDto } from './dto/weekly-reload-activation.dto';
import { WeeklyReloadCalculationDto } from './dto/weekly-reload-calculation.dto';

@Controller('bonuses')
@UseGuards(JwtAuthGuard)
export class BonusesController {
  private logger = new Logger(BonusesController.name);

  constructor(private readonly bonusesService: BonusesService) {}

  @Get('with-filters')
  async getBonusesWithFilters(@Query() filters: GetBonusesFilterDto) {
    return this.bonusesService.getBonusesWithFilters(filters);
  }

  @Post('cancel-batch')
  async cancelBonuses(
    @Body() cancelBonusesDto: CancelBonusesDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    const adminId = req.user.id;
    const result = await this.bonusesService.cancelBonusesBatch(cancelBonusesDto, adminId);

    this.logger.log('✅ Batch bonus cancellation completed:', {
      bonusIds: cancelBonusesDto.bonusIds,
      reason: cancelBonusesDto.reason,
      count: cancelBonusesDto.bonusIds.length,
      result: result,
    });

    return result;
  }

  @ApiOperation({ summary: 'Get Weekly Race prize distribution (top 9)' })
  @Get('weekly-race/prizes')
  async getWeeklyRacePrizes() {
    return this.bonusesService.getWeeklyRacePrizes();
  }

  @ApiOperation({
    summary: 'Update Weekly Race prize distribution (top 9). Takes effect next race.',
  })
  @Put('weekly-race/prizes')
  async updateWeeklyRacePrizes(@Body() body: UpdateWeeklyRacePrizesInput) {
    return this.bonusesService.updateWeeklyRacePrizes(body.prizes);
  }

  @ApiOperation({ summary: 'Calculate Weekly Reload bonus for a user' })
  @ApiResponse({ type: WeeklyReloadCalculationDto })
  @Post('weekly-reload/calculate')
  async calculateWeeklyReload(@Body() dto: CalculateWeeklyReloadDto) {
    return this.bonusesService.calculateWeeklyReload(dto.userId);
  }

  @ApiOperation({ summary: 'Activate Weekly Reload bonus for a user' })
  @ApiResponse({ type: WeeklyReloadActivationDto })
  @Post('weekly-reload/activate')
  async activateWeeklyReload(
    @Body() dto: ActivateWeeklyReloadDto,
    @Req() req: Request & { user: { id: string } },
  ) {
    const adminId = req.user.id;
    return this.bonusesService.activateWeeklyReload(dto.userId, adminId);
  }
}
