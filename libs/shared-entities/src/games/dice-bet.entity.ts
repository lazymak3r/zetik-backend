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

export enum DiceBetType {
  ROLL_OVER = 'ROLL_OVER',
  ROLL_UNDER = 'ROLL_UNDER',
}

export enum DiceBetStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'dice_bets', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'createdAt'])
@Index(['userId', 'createdAt', 'status'])
export class DiceBetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column('uuid')
  gameSessionId!: string;

  @Column('decimal', { precision: 20, scale: 8 })
  betAmount!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
    default: AssetTypeEnum.USDC,
  })
  asset!: AssetTypeEnum;

  @Column({
    type: 'enum',
    enum: DiceBetType,
  })
  betType!: DiceBetType;

  @Column('decimal', { precision: 5, scale: 2 })
  targetNumber!: string; // The target number for the bet (0.00-99.99)

  @Column('decimal', { precision: 10, scale: 4 })
  multiplier!: string; // The multiplier for potential winnings

  @Column('decimal', { precision: 5, scale: 2 })
  winChance!: string; // Win chance percentage (0.00-99.99)

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  rollResult!: string; // The actual dice roll result (0.00-99.99)

  @Column({
    type: 'enum',
    enum: DiceBetStatus,
    default: DiceBetStatus.PENDING,
  })
  status!: DiceBetStatus;

  @Column('decimal', { precision: 20, scale: 8, default: '0' })
  winAmount!: string; // Amount won (0 if lost)

  @Column('text', { nullable: true })
  clientSeed!: string; // User-provided randomness

  @Column('text', { nullable: true })
  serverSeed!: string; // Server-provided randomness (revealed after bet)

  @Column('text', { nullable: true })
  serverSeedHash!: string; // Hash of server seed (revealed before bet)

  @Column('int', { nullable: true })
  nonce!: number; // Nonce for provably fair

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
