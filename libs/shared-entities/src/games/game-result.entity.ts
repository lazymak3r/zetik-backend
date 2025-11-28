import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { GameSessionEntity } from './game-session.entity';

@Entity('game_results', { schema: DATABASE_SCHEMAS.GAMES })
@Index(['gameSessionId'])
@Index(['userId', 'createdAt'])
@Index(['userId', 'isWin', 'createdAt'])
export class GameResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  gameSessionId!: string;

  @ManyToOne(() => GameSessionEntity, (session) => session.gameResults)
  @JoinColumn({ name: 'gameSessionId' })
  gameSession!: GameSessionEntity;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'json' })
  outcomeData!: Record<string, any>;

  @Column('decimal', { precision: 12, scale: 2 })
  outcomeValue!: string;

  @Column({ length: 64 })
  verificationHash!: string;

  @Column({ default: false })
  isWin!: boolean;

  @Column('decimal', { precision: 36, scale: 18, nullable: true })
  multiplier?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
