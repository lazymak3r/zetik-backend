import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ProviderCategoryEntity,
  ProviderDeveloperEntity,
  ProviderGameEntity,
} from '@zetik/shared-entities';
import { FindOptionsWhere, ILike, In, MoreThanOrEqual, Repository } from 'typeorm';
import { IGetGamesResponse } from './dto/get-games-response.dto';
import { ProviderGamesGroupEnum } from './enums/provider-games-group.enum';
import { ICategoryEntity } from './interfaces/category.interface';
import { IDeveloperWithCount } from './interfaces/developer-with-count.interface';
import { IGameEntity } from './interfaces/game.interface';

@Injectable()
export class ProviderGamesService {
  constructor(
    @InjectRepository(ProviderGameEntity)
    private readonly gameRepository: Repository<ProviderGameEntity>,
    @InjectRepository(ProviderDeveloperEntity)
    private readonly developerRepository: Repository<ProviderDeveloperEntity>,
    @InjectRepository(ProviderCategoryEntity)
    private readonly categoryRepository: Repository<ProviderCategoryEntity>,
  ) {}

  async getGames(input?: {
    developerCodes?: string[];
    group?: ProviderGamesGroupEnum;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<IGetGamesResponse> {
    const page = input?.page && input.page > 0 ? input.page : 1;
    const limit = input?.limit && input.limit > 0 ? Math.min(input.limit, 100) : 50;
    const skip = (page - 1) * limit;

    // Optional group filters mapping
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const groupFilter: FindOptionsWhere<ProviderGameEntity> = (() => {
      switch (input?.group) {
        case ProviderGamesGroupEnum.SLOTS:
          return { category: { type: 'rng' } };
        case ProviderGamesGroupEnum.LIVE_CASINO:
          return { category: { type: 'live_dealer' } };
        case ProviderGamesGroupEnum.GAME_SHOWS:
          return { category: { name: 'Game Show' } };
        case ProviderGamesGroupEnum.BLACKJACK:
          return { category: { name: 'Live Blackjack' } };
        case ProviderGamesGroupEnum.ROULETTE:
          return { category: { name: 'Live Roulette' } };
        case ProviderGamesGroupEnum.BACCARAT:
          return { category: { name: 'Live Baccarat' } };
        case ProviderGamesGroupEnum.NEW_RELEASES:
          return { releaseDate: MoreThanOrEqual(sixMonthsAgo) };
        default:
          return {};
      }
    })();

    const search = input?.search?.trim();

    const [games, total] = await this.gameRepository.findAndCount({
      relations: ['developer', 'category'],
      where: {
        developer: {
          ...(input?.developerCodes ? { code: In(input.developerCodes) } : {}),
          enabled: true,
        },
        ...groupFilter,
        ...(search ? { name: ILike(`%${search}%`) } : {}),
        enabled: true,
      },
      skip,
      take: limit,
    });

    return {
      games,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getDevelopers(): Promise<IDeveloperWithCount[]> {
    return (await this.developerRepository
      .createQueryBuilder('provider_developers')
      .where('provider_developers.enabled = true')
      .select([
        'provider_developers.name as "name"',
        'provider_developers.code as "code"',
        'provider_developers.restrictedTerritories as "restrictedTerritories"',
        'provider_developers.prohibitedTerritories as "prohibitedTerritories"',
      ])
      .addSelect((subQuery) => {
        return subQuery
          .select('COUNT(*)::integer')
          .from('provider_games', 'provider_games')
          .where('"provider_games"."developerName" = "provider_developers"."name"')
          .andWhere('"provider_games"."enabled" = true');
      }, 'gamesCount')
      .execute()) as Promise<IDeveloperWithCount[]>;
  }

  async getCategories(): Promise<ICategoryEntity[]> {
    return this.categoryRepository.find();
  }

  async getGameByCode(code: string): Promise<IGameEntity | null> {
    return await this.gameRepository.findOne({
      where: { code },
      relations: ['developer', 'category'],
    });
  }
}
