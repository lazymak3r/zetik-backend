import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('crash_game_state', { schema: DATABASE_SCHEMAS.GAMES })
export class CrashGameStateEntity {
  @PrimaryColumn('integer', { default: 1 })
  id!: number;

  @Column('integer', { default: 10000000 })
  currentGameIndex!: number;

  @UpdateDateColumn()
  lastUpdated!: Date;
}
