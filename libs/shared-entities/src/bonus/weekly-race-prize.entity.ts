import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity({ name: 'weekly_race_prizes', schema: DATABASE_SCHEMAS.BONUS })
export class WeeklyRacePrizeEntity {
  @PrimaryColumn('integer')
  place!: number;

  @Column('decimal', { precision: 20, scale: 2 })
  amountUsd!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
