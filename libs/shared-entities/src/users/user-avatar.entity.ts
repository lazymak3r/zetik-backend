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

@Entity({ name: 'user_avatars', schema: DATABASE_SCHEMAS.USERS })
@Index(['userId', 'isActive'])
export class UserAvatarEntity {
  @ApiProperty({
    description: 'Unique avatar ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'User ID who owns this avatar',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity, (user) => user.avatars)
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @ApiProperty({
    description: 'Avatar image URL',
    example: 'https://example.com/avatars/user-123-1699999999.png',
  })
  @Column({ type: 'varchar', length: 500 })
  avatarUrl!: string;

  @ApiProperty({
    description: 'Whether this avatar is currently active for the user',
    example: true,
    default: false,
  })
  @Column({ type: 'boolean', default: false })
  isActive!: boolean;

  @ApiProperty({
    description: 'Original filename when uploaded',
    example: 'my-cool-avatar.png',
    required: false,
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFilename?: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 524288,
    required: false,
  })
  @Column({ type: 'integer', nullable: true })
  fileSize?: number;

  @ApiProperty({
    description: 'MIME type of the image',
    example: 'image/png',
    required: false,
  })
  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType?: string;

  @ApiProperty({
    description: 'Avatar upload timestamp',
    example: '2025-10-20T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;
}
