import { GameTypeEnum } from '@zetik/common';
import { Entity, Index, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('user_game_favorites', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'game'], { unique: true })
@Index(['userId'])
export class UserGameFavoritesEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn({
    type: 'enum',
    enum: GameTypeEnum,
  })
  game!: GameTypeEnum;
}
