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
import { CrashGameEntity } from './crash-game.entity';

export enum CrashBetStatusEnum {
  ACTIVE = 'ACTIVE',
  CASHED_OUT = 'CASHED_OUT',
  CRASHED = 'CRASHED',
  CANCELLED = 'CANCELLED',
}

@Entity('crash_bets', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['crashGameId'])
@Index(['userId', 'createdAt'])
@Index(['status'])
@Index(['userId', 'crashGameId', 'status'])
@Index(['crashGameId', 'status', 'createdAt'])
export class CrashBetEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  crashGameId!: string;

  @ManyToOne(() => CrashGameEntity, (game) => game.bets)
  @JoinColumn({ name: 'crashGameId' })
  crashGame!: CrashGameEntity;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: AssetTypeEnum,
  })
  asset!: AssetTypeEnum;

  @Column('decimal', { precision: 36, scale: 18 })
  betAmount!: string;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  winAmount?: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  cashOutAt?: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  autoCashOutAt?: string;

  @Column({ length: 64, nullable: true })
  clientSeed?: string;

  @Column({
    type: 'enum',
    enum: CrashBetStatusEnum,
    default: CrashBetStatusEnum.ACTIVE,
  })
  status!: CrashBetStatusEnum;

  @Column({ nullable: true })
  cashOutTime?: Date;

  // Fiat preservation fields for maintaining display precision
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  originalFiatAmount?: string;

  @Column({ length: 3, nullable: true })
  originalFiatCurrency?: string;

  @Column('decimal', { precision: 12, scale: 8, nullable: true })
  fiatToUsdRate?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
