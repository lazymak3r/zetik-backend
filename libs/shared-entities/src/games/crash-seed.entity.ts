import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('crash_seeds', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['gameIndex'], { unique: true })
export class CrashSeedEntity {
  @PrimaryColumn('integer')
  gameIndex!: number;

  @Column('varchar', { length: 64 })
  serverSeed!: string;
}
