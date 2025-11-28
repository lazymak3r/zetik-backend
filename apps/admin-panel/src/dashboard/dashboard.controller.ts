import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { GamesService } from '../games/games.service';
import { StatisticsService } from './services/statistics.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly gamesService: GamesService,
  ) {}

  @Get('stats')
  @Public()
  getStats() {
    return { message: 'Dashboard stats endpoint' };
  }

  @Get('games')
  @Public()
  @ApiQuery({ name: 'days', required: false, type: Number })
  getGames(@Query('days', new ParseIntPipe({ optional: true })) days: number = 7) {
    const validDays = Math.min(Math.max(days, 1), 365);
    return { message: `Games for last ${validDays} days` };
  }

  @Get('statistics')
  @Public()
  async getStatistics() {
    return await this.statisticsService.getDashboardStatistics();
  }

  @Get('revenue')
  @Public()
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getRevenue(@Query('days', new ParseIntPipe({ optional: true })) days: number = 30) {
    return await this.statisticsService.getRevenueStatistics(days);
  }

  @Get('game-configs')
  @Public()
  async getGameConfigs() {
    try {
      return await this.gamesService.getGameConfigs();
    } catch {
      return [];
    }
  }
}
