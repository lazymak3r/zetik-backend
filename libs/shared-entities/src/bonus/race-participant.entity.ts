import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';
import { RaceEntity } from './race.entity';

@Entity({ schema: 'bonus', name: 'race_participants' })
export class RaceParticipantEntity {
  @PrimaryColumn({ type: 'uuid' })
  raceId!: string;

  @PrimaryColumn({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => RaceEntity)
  @JoinColumn({ name: 'raceId' })
  race!: RaceEntity;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'bigint', default: 0 })
  totalWageredCents!: string;

  @Column({ type: 'int', nullable: true })
  place!: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  reward!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
