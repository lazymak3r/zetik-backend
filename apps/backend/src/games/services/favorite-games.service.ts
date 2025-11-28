import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GameTypeEnum, UserGameFavoritesEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

export interface IAddGameToFavoritesInput {
  userId: string;
  gameType: GameTypeEnum;
}

export interface IRemoveGameFromFavoritesInput {
  userId: string;
  gameType: GameTypeEnum;
}

export interface IGetUserFavoritesInput {
  userId: string;
}

@Injectable()
export class FavoriteGamesService {
  constructor(
    @InjectRepository(UserGameFavoritesEntity)
    private readonly favoritesRepo: Repository<UserGameFavoritesEntity>,
  ) {}

  async addGameToFavorites(input: IAddGameToFavoritesInput): Promise<void> {
    // Use INSERT ON CONFLICT DO NOTHING to avoid duplicate errors
    await this.favoritesRepo
      .createQueryBuilder()
      .insert()
      .into(UserGameFavoritesEntity)
      .values({
        userId: input.userId,
        game: input.gameType,
      })
      .onConflict('("userId", "game") DO NOTHING')
      .execute();
  }

  async removeGameFromFavorites(input: IRemoveGameFromFavoritesInput): Promise<void> {
    // delete() doesn't throw error if record doesn't exist
    await this.favoritesRepo.delete({
      userId: input.userId,
      game: input.gameType,
    });
  }

  async getUserFavorites(input: IGetUserFavoritesInput): Promise<string[]> {
    const favorites = await this.favoritesRepo.find({
      where: { userId: input.userId },
      select: ['game'],
    });

    return favorites.map((favorite) => favorite.game);
  }
}
