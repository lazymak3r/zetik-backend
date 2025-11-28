import { CurrencyEnum } from '@zetik/common';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';

export enum KenoRiskLevel {
  CLASSIC = 'CLASSIC',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum KenoGameStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'keno_games', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'status'])
@Index(['gameSessionId'])
export class KenoGameEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ nullable: true })
  gameSessionId?: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  betAmount!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
    default: AssetTypeEnum.BTC,
  })
  asset!: AssetTypeEnum;

  @Column({
    type: 'enum',
    enum: KenoGameStatus,
    default: KenoGameStatus.PENDING,
  })
  status!: KenoGameStatus;

  @Column({
    type: 'enum',
    enum: KenoRiskLevel,
    default: KenoRiskLevel.CLASSIC,
  })
  riskLevel!: KenoRiskLevel;

  @Column('simple-array')
  selectedNumbers!: number[];

  @Column('simple-array')
  drawnNumbers!: number[];

  @Column({ type: 'int', default: 0 })
  matches!: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  winAmount?: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: '0.00' })
  payoutMultiplier!: string;

  @Column()
  serverSeed!: string;

  @Column()
  serverSeedHash!: string;

  @Column()
  clientSeed!: string;

  @Column({ type: 'bigint', default: '1' })
  nonce!: string;

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
}
