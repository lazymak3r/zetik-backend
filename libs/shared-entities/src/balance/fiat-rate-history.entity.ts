import { CurrencyEnum } from '@zetik/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('fiat_rate_history', { schema: DATABASE_SCHEMAS.BALANCE })
export class FiatRateHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', enum: CurrencyEnum })
  currency!: CurrencyEnum;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  rate!: string; // Rate relative to USD

  @CreateDateColumn()
  createdAt!: Date;
}
