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

@Entity('provider_developers', { schema: DATABASE_SCHEMAS.GAMES })
export class ProviderDeveloperEntity {
  @PrimaryColumn()
  name!: string;

  @Column()
  code!: string;

  @Column('varchar', { array: true, nullable: true })
  restrictedTerritories?: string[];

  @Column('varchar', { array: true, nullable: true })
  prohibitedTerritories?: string[];

  @Column({ default: true })
  enabled!: boolean;

  @OneToMany(() => ProviderGameEntity, (game) => game.developer)
  games!: ProviderGameEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
