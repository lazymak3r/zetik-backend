import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AdminAccessGuard } from '../guards/admin-access.guard';
import {
  IActivateWeeklyReloadResponse,
  WeeklyReloadService,
} from '../services/weekly-reload.service';

@ApiExcludeController() // Скрыто от Swagger
@Controller('weekly-reload-admin')
@UseGuards(AdminAccessGuard)
export class WeeklyReloadAdminController {
  constructor(private readonly weeklyReloadService: WeeklyReloadService) {}

  @Post('activate/:userId')
  async activateWeeklyReload(
    @Param('userId') userId: string,
    @Body() body: { adminId?: string } = {},
  ): Promise<IActivateWeeklyReloadResponse> {
    const adminId = body.adminId || 'admin-panel';
    return this.weeklyReloadService.activateWeeklyReload(userId, adminId);
  }

  @Get('status/:userId')
  async getWeeklyReloadStatus(@Param('userId') userId: string): Promise<{
    hasActive: boolean;
    activeBonuses?: number;
    expirationDate?: Date;
  }> {
    return this.weeklyReloadService.checkActiveWeeklyReload(userId);
  }

  @Post('calculate/:userId')
  async calculateWeeklyReload(@Param('userId') userId: string): Promise<{
    userId: string;
    totalWeeklyAmount: number;
    dailyAmount: number;
    vipLevel: number;
    appliedPercentage: number;
    effectiveEdge: number;
    netResult: number;
    isProfitable: boolean;
    periodAnalyzed: string;
  }> {
    return this.weeklyReloadService.calculateWeeklyReloadAmount(userId);
  }
}
