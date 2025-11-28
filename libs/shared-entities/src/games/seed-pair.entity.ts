import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';

@Entity('seed_pairs', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['userId', 'isActive'])
@Index(['userId'], { unique: true, where: '"isActive" = true' })
export class SeedPairEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ length: 64 })
  serverSeed!: string;

  @Column({ length: 64 })
  serverSeedHash!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nextServerSeed!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  nextServerSeedHash!: string | null;

  @Column({ length: 64, default: 'default_client_seed' })
  clientSeed!: string;

  @Column({ type: 'bigint', default: 0 })
  nonce!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  revealedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
