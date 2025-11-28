import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('affiliate_statistics', { schema: DATABASE_SCHEMAS.AFFILIATE })
export class AffiliateStatisticEntity {
  @PrimaryColumn('uuid')
  userId!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  totalEarnedCents!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  totalClaimedCents!: string;
}
