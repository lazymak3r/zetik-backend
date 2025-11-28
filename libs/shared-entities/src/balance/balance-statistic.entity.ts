import { Column, Entity, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('balance_statistics', { schema: DATABASE_SCHEMAS.BALANCE })
export class BalanceStatisticEntity {
  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  deps!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  withs!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  bets!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  wins!: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  refunds!: string;

  @Column({ type: 'int', default: 0 })
  betCount!: number;

  @Column({ type: 'int', default: 0 })
  winCount!: number;
}
