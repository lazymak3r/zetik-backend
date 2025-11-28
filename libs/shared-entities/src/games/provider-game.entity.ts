import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { ProviderCategoryEntity } from './provider-category.entity';
import { ProviderDeveloperEntity } from './provider-developer.entity';

@Entity('provider_games', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['enabled', 'categoryName'])
@Index(['enabled', 'developerName'])
export class ProviderGameEntity {
  @PrimaryColumn()
  code!: string;

  @Column()
  name!: string;

  @Column()
  enabled!: boolean;

  @Column()
  developerName!: string;

  @ManyToOne(() => ProviderDeveloperEntity)
  @JoinColumn({ name: 'developerName', referencedColumnName: 'name' })
  developer!: ProviderDeveloperEntity;

  @Column()
  categoryName!: string;

  @ManyToOne(() => ProviderCategoryEntity)
  @JoinColumn({ name: 'categoryName', referencedColumnName: 'name' })
  category!: ProviderCategoryEntity;

  @Column('varchar', { array: true, nullable: true })
  bonusTypes?: string[];

  @Column('varchar', { array: true, nullable: true })
  themes?: string[];

  @Column('varchar', { array: true, nullable: true })
  features?: string[];

  @Column('decimal', { nullable: true, precision: 5, scale: 2 })
  rtp?: string | null;

  @Column('decimal', { precision: 5, scale: 2, default: '1.00' })
  houseEdge!: string;

  @Column('decimal', { nullable: true, precision: 5, scale: 2 })
  volatility?: string | null;

  @Column({ nullable: true })
  maxPayoutCoeff?: string;

  @Column({ nullable: true })
  hitRatio?: string;

  @Column({ default: false, nullable: true })
  funMode!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  releaseDate!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deprecationDate?: Date | null;

  @Column('varchar', { array: true, nullable: true })
  restrictedTerritories?: string[];

  @Column('varchar', { array: true, nullable: true })
  prohibitedTerritories?: string[];

  @Column('text', { nullable: true })
  description?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
