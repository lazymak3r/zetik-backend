import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { AdminAccessGuard } from '../bonus/guards/admin-access.guard';
import { CreateSt8BonusDto } from './dto/create-st8-bonus.dto';
import { ISt8CreateBonusParams } from './interfaces/st8-types.interface';
import { St8BonusService } from './st8-bonus.service';

@ApiTags('ST8 Bonus')
@UseGuards(AdminAccessGuard)
@Controller('provider-games/st8/bonus')
export class St8BonusController {
  private readonly logger = new Logger(St8BonusController.name);
  constructor(
    private readonly service: St8BonusService,
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

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
    @Headers('x-admin-id') adminId?: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID required (x-admin-id header)');
    }

    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
    if (!admin) {
      throw new NotFoundException(`Admin ${adminId} not found`);
    }

    this.logger.log(
      `create type=${body.type} players=${body.players?.length} adminId=${adminId} bonus_id=${body.bonus_id}`,
    );
    return await this.service.createBonus(body as ISt8CreateBonusParams, adminId);
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
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedOffset = offset ? Number(offset) : undefined;

    this.logger.log(
      `getLocalBonuses gameCode=${gameCode} type=${type} currency=${currency} status=${status} limit=${parsedLimit} offset=${parsedOffset}`,
    );
    return await this.service.getLocalBonuses({
      gameCode,
      type: type as any,
      currency,
      status: status as any,
      createdByAdminId,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  }

  @Get(':bonusId')
  @ApiOperation({ summary: 'Fetch ST8 bonus by id' })
  async fetch(@Param('bonusId') bonusId: string, @Query('site') site?: string) {
    const result = await this.service.fetchBonus(bonusId, site);

    try {
      await this.service.updateBonusStatusFromSt8(bonusId, site);
    } catch (error) {
      this.logger.warn(`Failed to update bonus status for ${bonusId}:`, error);
    }

    return result;
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
