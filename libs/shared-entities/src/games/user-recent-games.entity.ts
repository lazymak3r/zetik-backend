import { GameTypeEnum } from '@zetik/common';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

export interface IUserRecentGame {
  game: GameTypeEnum;
  gameName?: string;
}

@Entity({ name: 'user_recent_games', schema: DATABASE_SCHEMAS.GAMES })
export class UserRecentGamesEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @Column('jsonb')
  games!: IUserRecentGame[];
}
