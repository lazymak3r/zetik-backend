import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { St8BonusEntity, St8BonusStatusEnum, St8BonusTypeEnum } from '@zetik/shared-entities';
import { DataSource, Repository } from 'typeorm';
import { ISt8CreateBonusParams } from './interfaces/st8-types.interface';
import { St8ApiClient } from './st8-api-client.service';

@Injectable()
export class St8BonusService {
  private readonly logger = new Logger(St8BonusService.name);

  constructor(
    @InjectRepository(St8BonusEntity)
    private readonly st8BonusRepository: Repository<St8BonusEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly st8ApiClient: St8ApiClient,
  ) {}

  async getOffers(params: {
    game_codes?: string[];
    currency?: string;
    type?: string;
    site?: string;
  }) {
    return await this.st8ApiClient.getOffers(
      {
        ...params,
        type: params.type as any,
      },
      params.currency,
    );
  }

  async createBonus(body: ISt8CreateBonusParams, createdByAdminId: string) {
    return await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(St8BonusEntity, {
        where: { bonus_id: body.bonus_id },
      });
      if (existing) {
        throw new ConflictException(`Bonus ID already exists`);
      }

      const startTime = body.start_time ? new Date(body.start_time) : undefined;

      const st8Bonus = await manager.save(St8BonusEntity, {
        bonus_id: body.bonus_id,
        gameCodes: body.game_codes,
        type: body.type as unknown as St8BonusTypeEnum,
        value: body.value,
        currency: body.currency,
        players: body.players,
        count: body.count,
        site: body.site,
        startTime,
        duration: body.duration,
        createdByAdminId,
        status: St8BonusStatusEnum.PROCESSING,
      });

      const st8Response = await this.st8ApiClient.createBonus(body, body.currency);

      const mappedStatus = st8Response.bonus.status as St8BonusStatusEnum;
      await manager.update(
        St8BonusEntity,
        { bonus_id: st8Bonus.bonus_id },
        { status: mappedStatus },
      );

      return st8Response;
    });
  }

  async fetchBonus(bonusId: string, site?: string) {
    const response = await this.st8ApiClient.getBonus(bonusId, site);
    this.logger.log(`Fetched bonus ${bonusId} from ST8: ${JSON.stringify(response)}`);
    return response;
  }

  async updateBonusStatusFromSt8(bonusId: string, site?: string): Promise<void> {
    try {
      const st8Response = (await this.fetchBonus(bonusId, site)) as {
        status: string;
        bonus: {
          bonus_id: string;
          status: string;
        };
      };

      if (st8Response && st8Response.bonus && st8Response.bonus.status) {
        const newStatus = st8Response.bonus.status as St8BonusStatusEnum;

        await this.st8BonusRepository.update({ bonus_id: bonusId }, { status: newStatus });

        this.logger.log(`Updated bonus ${bonusId} status to ${newStatus}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update bonus ${bonusId} status from ST8:`, error);
      throw error;
    }
  }

  async cancelBonus(body: { bonus_id: string; site?: string; players?: string[] }) {
    const st8Response = await this.st8ApiClient.cancelBonus(body);

    const currentBonus = await this.st8BonusRepository.findOne({
      where: { bonus_id: body.bonus_id },
    });

    if (!currentBonus) {
      throw new Error(`Bonus ${body.bonus_id} not found`);
    }

    const activePlayers =
      st8Response.bonus.instances
        ?.filter((instance) => instance.status !== 'canceled')
        .map((instance) => instance.player) || [];

    const bonusStatus = st8Response.bonus.status as St8BonusStatusEnum;

    await this.st8BonusRepository.update(
      { bonus_id: body.bonus_id },
      {
        players: activePlayers,
        status: bonusStatus,
      },
    );

    return st8Response;
  }

  private sanitizeForLike(value: string): string {
    return value.replace(/[%_\\]/g, '\\$&');
  }

  async getLocalBonuses(filters: {
    gameCode?: string;
    type?: St8BonusTypeEnum;
    currency?: string;
    createdByAdminId?: string;
    status?: St8BonusStatusEnum;
    limit?: number;
    offset?: number;
  }) {
    const queryBuilder = this.st8BonusRepository.createQueryBuilder('bonus');

    this.logger.log(`getLocalBonuses filters: ${JSON.stringify(filters)}`);

    if (filters.gameCode) {
      const sanitizedGameCode = this.sanitizeForLike(filters.gameCode);
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(bonus.gameCodes) AS game_code 
          WHERE game_code ILIKE :gameCode
        )`,
        { gameCode: `%${sanitizedGameCode}%` },
      );
    }

    if (filters.type) {
      queryBuilder.andWhere('bonus.type = :type', { type: filters.type });
    }

    if (filters.currency) {
      const sanitizedCurrency = this.sanitizeForLike(filters.currency);
      queryBuilder.andWhere('bonus.currency ILIKE :currency', {
        currency: `%${sanitizedCurrency}%`,
      });
    }

    if (filters.createdByAdminId) {
      queryBuilder.andWhere('bonus.createdByAdminId = :createdByAdminId', {
        createdByAdminId: filters.createdByAdminId,
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('bonus.status = :status', { status: filters.status });
    }

    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }

    if (filters.offset) {
      queryBuilder.offset(filters.offset);
    }

    queryBuilder.orderBy('bonus.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }
}
