import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';

@Entity('phone_verifications', { schema: DATABASE_SCHEMAS.USERS })
@Index(['phoneNumber', 'expiresAt'])
export class PhoneVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @Index()
  @Column()
  phoneNumber!: string;

  @Column()
  code!: string;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column()
  expiresAt!: Date;

  @Column({ default: false })
  isUsed!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
