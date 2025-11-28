import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { ChatEntity } from './chat.entity';
import { ChatMessageTypeEnum } from './enums/chat-message-type.enum';
import { ITipMessageMetadata } from './interfaces/tip-metadata.interface';

@Entity({ name: 'messages', schema: DATABASE_SCHEMAS.CHAT })
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  chatId!: string;

  @ManyToOne(() => ChatEntity)
  @JoinColumn({ name: 'chatId' })
  chat!: ChatEntity;

  @Column()
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: ChatMessageTypeEnum,
    default: ChatMessageTypeEnum.MESSAGE,
  })
  messageType!: ChatMessageTypeEnum;

  @Column({ nullable: true })
  message?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: ITipMessageMetadata | Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;
}
