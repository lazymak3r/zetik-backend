import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'rakeback', schema: DATABASE_SCHEMAS.BALANCE })
export class RakebackEntity {
  @PrimaryColumn({ type: 'uuid', comment: 'User ID' })
  userId!: string;

  @PrimaryColumn({
    type: 'varchar',
    length: 10,
    comment: 'Asset type (BTC, ETH, USDT, etc.)',
  })
  asset!: string;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    default: '0.00000000',
    comment: 'Accumulated house side amount in native asset',
  })
  accumulatedHouseSideAmount!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
