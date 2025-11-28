import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { ProviderGameEntity } from './provider-game.entity';

@Entity('user_provider_game_favorites', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'code'], { unique: true })
@Index(['userId'])
export class UserProviderGameFavoritesEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @PrimaryColumn()
  code!: string;

  @ManyToOne(() => ProviderGameEntity)
  @JoinColumn({ name: 'code', referencedColumnName: 'code' })
  game!: ProviderGameEntity;
}
