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

export enum SportsbookBetStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  WON = 'won',
  LOST = 'lost',
  CANCELED = 'canceled',
  REFUND = 'refund',
  'CASHED OUT' = 'cashed out',
  'HALF-WON' = 'half-won',
  'HALF-LOST' = 'half-lost',
  OPEN = 'open',
}

export enum SportsbookBetType {
  SINGLE = 'single',
  ACCUMULATOR = 'accumulator',
  SYSTEM = 'system',
  CHAIN = 'chain',
}

export enum BonusType {
  FREEBET_REFUND = 'freebet_refund',
  FREEBET_FREEMONEY = 'freebet_freemoney',
  FREEBET_NO_RISK = 'freebet_no_risk',
  GLOBAL_COMBOBOOST = 'global_comboboost',
  COMBOBOOST = 'comboboost',
}

export enum SelectionStatus {
  OPEN = 'open',
  WON = 'won',
  LOST = 'lost',
  CANCELED = 'canceled',
  REFUND = 'refund',
  HALF_WON = 'half-won',
  HALF_LOST = 'half-lost',
}

export interface BetSelection {
  id: string;
  eventId: string;
  sportId?: string;
  tournamentId?: string;
  categoryId?: string;
  live?: boolean;
  sportName?: string;
  categoryName?: string;
  tournamentName?: string;
  competitorName?: string[];
  marketName?: string;
  outcomeName?: string;
  scheduled?: number;
  odds?: string;
  status?: 'open' | 'won' | 'lost' | 'canceled' | 'refund' | 'half-won' | 'half-lost';
}

@Entity({ name: 'sportsbook_bets', schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'status'])
@Index(['userId', 'createdAt'])
@Index(['betslipId'])
export class SportsbookBetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { nullable: true })
  betCommitOperationId?: string;

  @Column()
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column('varchar', { length: 100 })
  extTransactionId!: string;

  @Column('varchar', { length: 100 })
  betslipId!: string;

  @Column('decimal', { precision: 20, scale: 8 })
  betAmount!: string;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  potentialWin?: string;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  potentialComboboostWin?: string;

  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  actualWin?: string;

  @Column('decimal', { precision: 10, scale: 4 })
  totalOdds!: string;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
    default: AssetTypeEnum.USDT,
  })
  asset!: AssetTypeEnum;

  @Column({
    type: 'enum',
    enum: CurrencyEnum,
    default: CurrencyEnum.USD,
  })
  currency!: CurrencyEnum;

  @Column({
    type: 'enum',
    enum: SportsbookBetStatus,
    default: SportsbookBetStatus.PENDING,
  })
  status!: SportsbookBetStatus;

  @Column({
    type: 'enum',
    enum: SportsbookBetType,
    default: SportsbookBetType.SINGLE,
  })
  betType!: SportsbookBetType;

  @Column('varchar', { length: 100, nullable: true })
  bonusId?: string;

  @Column({
    type: 'enum',
    enum: BonusType,
    nullable: true,
  })
  bonusType?: BonusType;

  @Column('varchar', { length: 20, nullable: true })
  comboboostMultiplier?: string;

  @Column('jsonb')
  selections!: BetSelection[];

  @Column({ default: false })
  isQuickBet!: boolean;

  @Column({ default: false })
  acceptOddsChange!: boolean;

  @Column({ default: false })
  isCashout!: boolean;

  @Column({ default: false })
  isSnrLost!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
