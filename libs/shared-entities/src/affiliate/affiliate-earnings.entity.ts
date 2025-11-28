import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('affiliate_earnings', { schema: 'affiliate' })
export class AffiliateEarningsEntity {
  @PrimaryColumn({ type: 'uuid', name: 'referredUserId' })
  referredUserId!: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  asset!: string;

  @Column({ type: 'uuid', name: 'affiliateId' })
  affiliateId!: string;

  @Index()
  @Column({ type: 'varchar' })
  campaignCode!: string;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: 0 })
  earned!: string;

  @Column({ type: 'decimal', precision: 25, scale: 10, default: 0 })
  wagered!: string;
}
