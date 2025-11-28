import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProviderGameEntity, UserProviderGameFavoritesEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { IGetProviderFavoritesResponse } from '../dto/get-provider-favorites-response.dto';
import { IGameEntity } from '../interfaces/game.interface';

export interface IAddProviderGameToFavoritesInput {
  userId: string;
  gameCode: string;
}

export interface IRemoveProviderGameFromFavoritesInput {
  userId: string;
  gameCode: string;
}

export interface IGetUserProviderFavoritesInput {
  userId: string;
  page?: number;
  limit?: number;
}

// Export for backward compatibility
export type IProviderGameFavorite = IGameEntity;

@Injectable()
export class ProviderFavoritesService {
  constructor(
    @InjectRepository(UserProviderGameFavoritesEntity)
    private readonly providerFavoritesRepo: Repository<UserProviderGameFavoritesEntity>,
    @InjectRepository(ProviderGameEntity)
    private readonly providerGameRepo: Repository<ProviderGameEntity>,
  ) {}

  async addGameToFavorites(input: IAddProviderGameToFavoritesInput): Promise<void> {
    // First verify the game exists and is enabled
    const game = await this.providerGameRepo.findOne({
      where: { code: input.gameCode, enabled: true },
    });

    if (!game) {
      throw new NotFoundException(`Provider game '${input.gameCode}' not found or not enabled`);
    }

    // Use INSERT ON CONFLICT DO NOTHING to avoid duplicate errors
    await this.providerFavoritesRepo
      .createQueryBuilder()
      .insert()
      .into(UserProviderGameFavoritesEntity)
      .values({
        userId: input.userId,
        code: input.gameCode,
      })
      .onConflict('("userId", "code") DO NOTHING')
      .execute();
  }

  async removeGameFromFavorites(input: IRemoveProviderGameFromFavoritesInput): Promise<void> {
    // delete() doesn't throw error if record doesn't exist
    await this.providerFavoritesRepo.delete({
      userId: input.userId,
      code: input.gameCode,
    });
  }

  async getUserFavorites(
    input: IGetUserProviderFavoritesInput,
  ): Promise<IGetProviderFavoritesResponse> {
    const page = input.page || 1;
    const limit = input.limit || 50;
    const skip = (page - 1) * limit;

    const favorites = await this.providerFavoritesRepo.find({
      where: { userId: input.userId },
      relations: ['game', 'game.developer', 'game.category'],
      skip,
      take: limit,
    });

    // Return games in the same structure as /provider-games/games
    return {
      games: favorites.map((favorite) => favorite.game),
    };
  }
}
