import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  UpdateDateColumn,
} from 'typeorm';
import { AdminEntity } from '../admin/admin.entity';
import { DATABASE_SCHEMAS } from '../database-schemas';

export enum St8BonusTypeEnum {
  FREE_BETS = 'free_bets',
  FREE_MONEY = 'free_money',
  BONUS_GAME = 'bonus_game',
}

export enum St8BonusStatusEnum {
  PROCESSING = 'processing',
  FINISHED = 'finished',
  ERROR = 'error',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

@Entity({ name: 'st8_bonuses', schema: DATABASE_SCHEMAS.BONUS })
@Index(['gameCodes'])
@Index(['type'])
@Index(['status'])
@Index(['createdByAdminId'])
export class St8BonusEntity {
  @Column({ type: 'varchar', primary: true })
  bonus_id!: string;

  @Column({ type: 'jsonb', name: 'game_codes' })
  gameCodes!: string[];

  @Column({ type: 'enum', enum: St8BonusTypeEnum })
  type!: St8BonusTypeEnum;

  @Column({ type: 'enum', enum: St8BonusStatusEnum, default: St8BonusStatusEnum.PROCESSING })
  status!: St8BonusStatusEnum;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  value!: string;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Column({ type: 'jsonb' })
  players!: string[];

  @Column({ type: 'int', nullable: true })
  count?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  site?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'start_time' })
  startTime?: Date;

  @Column({ type: 'int', nullable: true })
  duration?: number;

  @Column({ type: 'uuid', name: 'created_by_admin_id' })
  createdByAdminId!: string;

  @ManyToOne(() => AdminEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_admin_id' })
  createdByAdmin?: AdminEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
