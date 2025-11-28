import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { BonusVipTierEntity } from './bonus-vip-tier.entity';

@Entity({ name: 'bonuses_user_vip_status', schema: DATABASE_SCHEMAS.BONUS })
export class UserVipStatusEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    default: '0',
    comment: 'Total net wagered amount by the user (bets - refunds) in cents',
  })
  currentWager!: string;

  @Column({
    type: 'smallint',
    default: 0,
    comment: 'Current VIP level of the user, references bonuses_vip_tiers.level',
  })
  currentVipLevel!: number;

  @ManyToOne(() => BonusVipTierEntity)
  @JoinColumn({ name: 'currentVipLevel', referencedColumnName: 'level' })
  currentBonusVipTier!: BonusVipTierEntity;

  @Column({
    type: 'smallint',
    default: 0,
    comment: 'Previous VIP level, to prevent double level-up bonus payout',
  })
  previousVipLevel!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
