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
import { UserEntity } from './users.entity';

export enum VerificationStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export enum DocumentType {
  GOVERNMENT_ID = 'government_id',
  DRIVERS_LICENSE = 'drivers_license',
  PASSPORT = 'passport',
  NATIONAL_ID = 'national_id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  UTILITY_BILL = 'utility_bill',
  BANK_STATEMENT = 'bank_statement',
  SELFIE_WITH_ID = 'selfie_with_id',
}

export enum VerificationLevel {
  LEVEL_1_EMAIL = 'level_1_email',
  LEVEL_2_BASIC_INFO = 'level_2_basic_info',
  LEVEL_3_IDENTITY = 'level_3_identity',
}

@Entity('user_verifications', { schema: DATABASE_SCHEMAS.USERS })
export class UserVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({
    type: 'enum',
    enum: VerificationLevel,
  })
  level!: VerificationLevel;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.NOT_STARTED,
  })
  status!: VerificationStatus;

  @Column({ nullable: true })
  rejectionReason?: string;

  @Column({ nullable: true })
  adminNotes?: string;

  @Column({ nullable: true })
  reviewedBy?: string; // Admin user ID who reviewed

  @Column({ nullable: true })
  reviewedAt?: Date;

  @Column({ nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('verification_documents', { schema: DATABASE_SCHEMAS.USERS })
export class VerificationDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'verification_id', type: 'uuid' })
  @Index()
  verificationId!: string;

  @ManyToOne(() => UserVerificationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verification_id' })
  verification!: UserVerificationEntity;

  @Column({
    type: 'enum',
    enum: DocumentType,
  })
  documentType!: DocumentType;

  @Column()
  originalFileName!: string;

  @Column()
  storedFileName!: string;

  @Column()
  filePath!: string;

  @Column()
  mimeType!: string;

  @Column({ type: 'bigint' })
  fileSize!: number;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status!: VerificationStatus;

  @Column({ nullable: true })
  rejectionReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('verification_basic_info', { schema: DATABASE_SCHEMAS.USERS })
export class VerificationBasicInfoEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column()
  dateOfBirth!: Date;

  @Column()
  phoneNumber!: string;

  @Column()
  address!: string;

  @Column()
  city!: string;

  @Column()
  state!: string;

  @Column()
  postalCode!: string;

  @Column()
  country!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
