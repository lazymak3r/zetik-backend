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
import { AdminEntity } from '../admin/admin.entity';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { UserEntity } from '../users/users.entity';
import { VipTransferCasinoEnum } from './enums/vip-transfer-casino.enum';
import { VipTransferTagEnum } from './enums/vip-transfer-tag.enum';

@Entity({ name: 'bonuses_vip_transfer_submissions', schema: DATABASE_SCHEMAS.BONUS })
@Index(['userId'])
@Index(['tag'])
@Index(['createdAt'])
export class VipTransferSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'userId' })
  user!: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  country!: string;

  @Column({ type: 'varchar', length: 50, default: 'telegram' })
  contactMethod!: string;

  @Column({ type: 'varchar', length: 255, name: 'contactUsername' })
  contactUsername!: string;

  @Column({
    type: 'enum',
    enum: VipTransferCasinoEnum,
  })
  casino!: VipTransferCasinoEnum;

  @Column({ type: 'varchar', length: 255 })
  casinoUsername!: string;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    comment: 'Total wager in cents',
  })
  totalWager!: string;

  @Column({ type: 'varchar', length: 255 })
  rank!: string;

  @Column({ type: 'text', nullable: true })
  howDidYouHear?: string;

  @Column({
    type: 'enum',
    enum: VipTransferTagEnum,
    nullable: true,
    default: VipTransferTagEnum.NEW,
  })
  tag?: VipTransferTagEnum;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Additional notes from admin',
  })
  customNote?: string;

  @Column({ type: 'uuid', nullable: true, name: 'tagged_by_admin_id' })
  taggedByAdminId?: string;

  @ManyToOne(() => AdminEntity, { nullable: true })
  @JoinColumn({ name: 'tagged_by_admin_id' })
  taggedByAdmin?: AdminEntity;

  @Column({ type: 'timestamp', nullable: true, name: 'tagged_at' })
  taggedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
