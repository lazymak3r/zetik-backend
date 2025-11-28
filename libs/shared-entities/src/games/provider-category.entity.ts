import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { ProviderGameEntity } from './provider-game.entity';

@Entity('provider_categories', { schema: DATABASE_SCHEMAS.GAMES })
export class ProviderCategoryEntity {
  @PrimaryColumn()
  name!: string;

  @Column()
  type!: string;

  @OneToMany(() => ProviderGameEntity, (game) => game.category)
  games!: ProviderGameEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
