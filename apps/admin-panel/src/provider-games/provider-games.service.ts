import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProviderDeveloperEntity, ProviderGameEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { ProviderDeveloperDto } from './dto/provider-developer.dto';
import { ProviderGameDto } from './dto/provider-game.dto';
import { UpdateProviderDeveloperDto } from './dto/update-provider-developer.dto';
import { UpdateProviderGameDto } from './dto/update-provider-game.dto';

@Injectable()
export class ProviderGamesService {
  constructor(
    @InjectRepository(ProviderDeveloperEntity)
    private readonly developerRepository: Repository<ProviderDeveloperEntity>,
    @InjectRepository(ProviderGameEntity)
    private readonly gameRepository: Repository<ProviderGameEntity>,
  ) {}

  async getDevelopers(): Promise<ProviderDeveloperDto[]> {
    const rows = await this.developerRepository
      .createQueryBuilder('developer')
      .leftJoin('developer.games', 'game')
      .select(['developer.name AS name', 'developer.code AS code', 'developer.enabled AS enabled'])
      .addSelect('COUNT(game.code)::int', 'gamesCount')
      .groupBy('developer.name')
      .addGroupBy('developer.code')
      .addGroupBy('developer.enabled')
      .orderBy('developer.name', 'ASC')
      .getRawMany<{ name: string; code: string; enabled: boolean; gamesCount: number }>();

    return rows.map(({ name, code, enabled, gamesCount }) => ({
      name,
      code,
      enabled: enabled ?? true,
      gamesCount: gamesCount ?? 0,
    }));
  }

  async updateDeveloper(
    name: string,
    dto: UpdateProviderDeveloperDto,
  ): Promise<ProviderDeveloperDto> {
    const developer = await this.developerRepository.findOne({ where: { name } });
    if (!developer) {
      throw new NotFoundException(`Provider developer with name ${name} not found`);
    }

    if (dto.enabled !== undefined) {
      developer.enabled = dto.enabled;
      await this.developerRepository.save(developer);

      await this.gameRepository.update({ developerName: name }, { enabled: dto.enabled });
    }

    const gamesCount = await this.gameRepository.count({ where: { developerName: name } });

    return {
      name: developer.name,
      code: developer.code,
      enabled: developer.enabled,
      gamesCount,
    };
  }

  async getGamesByDeveloper(developerName: string): Promise<ProviderGameDto[]> {
    const games = await this.gameRepository.find({
      where: { developerName },
      select: ['code', 'name', 'description'],
    });

    return games.map((game) => ({
      code: game.code,
      name: game.name,
      description: game.description ?? null,
    }));
  }

  async getGameByCode(code: string): Promise<ProviderGameDto> {
    const game = await this.gameRepository.findOne({
      where: { code },
      select: ['code', 'name', 'description'],
    });

    if (!game) {
      throw new NotFoundException(`Provider game with code ${code} not found`);
    }

    return {
      code: game.code,
      name: game.name,
      description: game.description ?? null,
    };
  }

  async updateGameDescription(code: string, dto: UpdateProviderGameDto): Promise<ProviderGameDto> {
    const game = await this.gameRepository.findOne({ where: { code } });
    if (!game) {
      throw new NotFoundException(`Provider game with code ${code} not found`);
    }

    if (dto.description !== undefined) {
      game.description = dto.description;
      await this.gameRepository.save(game);
    }

    return {
      code: game.code,
      name: game.name,
      description: game.description ?? null,
    };
  }
}
