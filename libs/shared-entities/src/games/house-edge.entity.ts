import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('house_edge', { schema: DATABASE_SCHEMAS.GAMES })
export class HouseEdgeEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  game!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  edge!: number;
}
