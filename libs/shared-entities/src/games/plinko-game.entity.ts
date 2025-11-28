import { CurrencyEnum } from '@zetik/common';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum PlinkoGameStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('plinko_games', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'createdAt'])
@Index(['status'])
export class PlinkoGameEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
  })
  asset!: AssetTypeEnum;

  @Column('decimal', { precision: 18, scale: 8 })
  betAmount!: string;

  @Column({
    type: 'enum',
    enum: RiskLevel,
  })
  riskLevel!: RiskLevel;

  @Column('int')
  rowCount!: number;

  @Column('int')
  bucketIndex!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  multiplier!: string;

  @Column('decimal', { precision: 18, scale: 8 })
  winAmount!: string;

  @Column({
    type: 'enum',
    enum: PlinkoGameStatus,
    default: PlinkoGameStatus.ACTIVE,
  })
  status!: PlinkoGameStatus;

  // Provably fair fields
  @Column('text')
  clientSeed!: string;

  @Column('text')
  serverSeed!: string;

  @Column('text')
  serverSeedHash!: string;

  @Column('int')
  nonce!: number;

  // Optional ball path for physics simulation replay
  @Column('jsonb', { nullable: true })
  ballPath?: number[];

  // Fiat currency preservation fields for display consistency
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  originalFiatAmount?: string;

  @Column({ type: 'varchar', length: 3, nullable: true })
  originalFiatCurrency?: CurrencyEnum;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  fiatToUsdRate?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Temporary field for user data (not persisted)
  user?: any;
}
