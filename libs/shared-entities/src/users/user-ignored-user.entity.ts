import { ApiProperty } from '@nestjs/swagger';
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
import { UserEntity } from './users.entity';

@Entity('user_ignored_users', { schema: DATABASE_SCHEMAS.USERS })
@Index(['ignorerId', 'ignoredUserId'], { unique: true }) // Prevent duplicate ignores
export class UserIgnoredUserEntity {
  @ApiProperty({
    description: 'Unique ID for the ignore relationship',
    example: 1,
  })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({
    description: 'ID of the user who is ignoring',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Index()
  @Column('uuid')
  ignorerId!: string;

  @ApiProperty({
    description: 'ID of the user being ignored',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @Index()
  @Column('uuid')
  ignoredUserId!: string;

  @ApiProperty({
    description: 'User who is ignoring (ignorer)',
  })
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'ignorerId' })
  ignorer!: UserEntity;

  @ApiProperty({
    description: 'User being ignored',
  })
  @ManyToOne(() => UserEntity, { eager: false })
  @JoinColumn({ name: 'ignoredUserId' })
  ignoredUser!: UserEntity;

  @ApiProperty({
    description: 'When the ignore relationship was created',
    example: '2025-05-12T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;
}
