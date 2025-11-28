import { Controller, Get, Header, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BetsReportService } from './services/bets-report.service';

@ApiTags('bets')
@Controller('games/bets')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth()
export class BetsReportController {
  constructor(private readonly betsReportService: BetsReportService) {}

  @ApiOperation({ summary: 'Get bet archive (counts by day) for current user' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Last N days' })
  @Get('archive')
  async getArchive(
    @CurrentUser() user: UserEntity,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
    @Query('sortBy') sortBy?: 'date',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return await this.betsReportService.getArchiveByDay({
      userId: user.id,
      limit,
      offset,
      sortBy,
      sortOrder,
    });
  }

  @ApiOperation({ summary: 'Export detailed bets as JSON file for current user' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max rows (1..5000)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination' })
  @Get('export')
  @Header('Content-Type', 'application/json')
  async exportBets(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('offset', new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    const data = await this.betsReportService.exportBets({
      userId: user.id,
      from,
      to,
      limit,
      offset,
    });
    const filename = `bets-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return data; // Nest will serialize to JSON with the headers set
  }
}
