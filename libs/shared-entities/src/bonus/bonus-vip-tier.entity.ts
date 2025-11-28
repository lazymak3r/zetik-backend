import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'bonuses_vip_tiers', schema: DATABASE_SCHEMAS.BONUS })
export class BonusVipTierEntity {
  @PrimaryColumn({
    type: 'smallint',
  })
  level!: number;

  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string;

  @Column({
    type: 'boolean',
    default: false,
    comment: 'Is this a VIP tier',
  })
  isForVip!: boolean;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'URL for tier image',
  })
  imageUrl?: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    comment: 'Wager required to reach this level in cents',
  })
  wagerRequirement!: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'One-time bonus for reaching this level in cents',
  })
  levelUpBonusAmount?: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Rakeback percentage (0-100), e.g., 5.00 for 5%',
  })
  rakebackPercentage?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'One-time bonus for moving between major ranks (first level of rank) in cents',
  })
  rankUpBonusAmount?: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Weekly bonus percentage of wager (0-100.00)',
  })
  weeklyBonusPercentage?: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Monthly bonus percentage of wager (0-100.00)',
  })
  monthlyBonusPercentage?: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Weekly reload bonus percentage if net profitable (0-100.00)',
  })
  weeklyReloadProfitablePercentage?: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    comment: 'Weekly reload bonus percentage if net losing (0-100.00)',
  })
  weeklyReloadLosingPercentage?: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: 'Minimum daily weekly reload amount in cents',
  })
  weeklyReloadDailyMinCents?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'User who created this tier',
  })
  createdBy?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    comment: 'User who last updated this tier',
  })
  updatedBy?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
