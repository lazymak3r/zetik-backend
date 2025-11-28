import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('affiliate_campaigns', { schema: DATABASE_SCHEMAS.AFFILIATE })
export class AffiliateCampaignEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;

  // Human-friendly referral code; must be unique (case-insensitive)
  // TODO: Make this the primary key instead of id to simplify code
  @Column({ nullable: false })
  code!: string;

  @Column({ default: '0' })
  totalCommission!: string;

  @Column({ default: 0 })
  totalReferrals!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
