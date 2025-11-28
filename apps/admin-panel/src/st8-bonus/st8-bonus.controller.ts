import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminEntity } from '@zetik/shared-entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { CreateSt8BonusDto } from './dto/create-st8-bonus.dto';
import { St8BonusService } from './st8-bonus.service';

@ApiTags('Admin ST8 Bonus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('st8/bonus')
export class St8BonusController {
  private readonly logger = new Logger(St8BonusController.name);
  constructor(private readonly service: St8BonusService) {}

  @Get('games')
  @ApiOperation({ summary: 'List ST8 games' })
  async getGames() {
    return this.service.getGames();
  }

  @Get('offers')
  @ApiOperation({ summary: 'List ST8 bonus offers' })
  async getOffers(
    @Query('game_codes') gameCodes?: string,
    @Query('currency') currency?: string,
    @Query('type') type?: string,
    @Query('site') site?: string,
  ) {
    const game_codes = gameCodes
      ? gameCodes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    this.logger.log(`offers query type=${type} currency=${currency} site=${site}`);
    return await this.service.getOffers({ game_codes, currency, type, site });
  }

  @Post()
  @ApiOperation({ summary: 'Create ST8 bonus' })
  async create(
    @Body(new ValidationPipe({ transform: true })) body: CreateSt8BonusDto,
    @CurrentAdmin() admin: AdminEntity,
  ) {
    this.logger.log(
      `create type=${body.type} players=${body.players?.length} adminId=${admin.id} bonus_id=${body.bonus_id}`,
    );
    return await this.service.createBonus(body as unknown as Record<string, unknown>, admin.id);
  }

  @Get('local')
  @ApiOperation({ summary: 'List local ST8 bonuses from database' })
  async getLocalBonuses(
    @Query('gameCode') gameCode?: string,
    @Query('type') type?: string,
    @Query('currency') currency?: string,
    @Query('status') status?: string,
    @Query('createdByAdminId') createdByAdminId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    this.logger.log(
      `getLocalBonuses gameCode=${gameCode} type=${type} currency=${currency} status=${status}`,
    );
    return await this.service.getLocalBonuses({
      gameCode,
      type,
      currency,
      status,
      createdByAdminId,
      limit,
      offset,
    });
  }

  @Get(':bonusId')
  @ApiOperation({ summary: 'Fetch ST8 bonus by id' })
  async fetch(@Param('bonusId') bonusId: string, @Query('site') site?: string) {
    this.logger.log(`get bonus_id=${bonusId} site=${site}`);
    return await this.service.fetchBonus(bonusId, site);
  }

  @Post(':bonusId/cancel')
  @ApiOperation({ summary: 'Cancel ST8 bonus' })
  async cancel(
    @Param('bonusId') bonusId: string,
    @Body() body: { site?: string; players?: string[] },
  ) {
    this.logger.warn(`cancel bonus_id=${bonusId} players=${body?.players?.length ?? 0}`);
    return await this.service.cancelBonus({
      bonus_id: bonusId,
      site: body?.site,
      players: body?.players,
    });
  }
}
