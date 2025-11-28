import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DATABASE_SCHEMAS } from '../database-schemas';
import { DefaultAvatarEntity } from './default-avatar.entity';
import { AuthStrategyEnum } from './enums/auth-strategy.enum';
import { UserAvatarEntity } from './user-avatar.entity';

// Email registration data interface
export interface IEmailRegistrationData {
  passwordHash: string;
}

export interface IMetamaskRegistrationData {
  address: string;
}

export interface IPhantomRegistrationData {
  address: string;
}

export interface ITelegramRegistrationData {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface IGoogleRegistrationData {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface ISteamRegistrationData {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl?: string;
  realName?: string;
  countryCode?: string;
}

// For future registration strategies
export type RegistrationDataType =
  | IEmailRegistrationData
  | IMetamaskRegistrationData
  | IPhantomRegistrationData
  | ITelegramRegistrationData
  | IGoogleRegistrationData
  | ISteamRegistrationData;

@Entity('users', { schema: DATABASE_SCHEMAS.USERS })
export class UserEntity {
  @ApiProperty({
    description: 'Unique user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryColumn('uuid')
  id!: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  @Column({ unique: true })
  username!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
    required: false,
  })
  @Column({ nullable: true, unique: true })
  email?: string;

  @ApiProperty({
    description: 'Flag indicating if email is verified',
    example: false,
    default: false,
  })
  @Column({ default: false })
  isEmailVerified!: boolean;

  @ApiProperty({
    description: 'Phone number',
    example: '+1234567890',
    required: false,
  })
  @Column({ nullable: true, unique: true })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Flag indicating if phone number is verified',
    example: false,
    default: false,
  })
  @Column({ default: false })
  isPhoneVerified!: boolean;

  @ApiProperty({
    description: 'Phone number verification timestamp',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  @Column({ nullable: true })
  phoneVerifiedAt?: Date;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
    required: false,
  })
  @Column({ nullable: true })
  displayName?: string;

  @ApiProperty({
    description: 'User bio/description',
    example: 'Love playing casino games and exploring new strategies!',
    required: false,
  })
  @Column({ nullable: true, length: 500 })
  bio?: string;

  @ApiProperty({
    description: 'Avatar URL (deprecated - use avatars relation)',
    example: 'https://example.com/avatar.jpg',
    required: false,
    deprecated: true,
  })
  @Column({ nullable: true })
  avatarUrl?: string;

  @ApiProperty({
    description: 'User avatar gallery',
    type: () => UserAvatarEntity,
    isArray: true,
    required: false,
  })
  @OneToMany(() => UserAvatarEntity, (avatar) => avatar.user)
  avatars?: UserAvatarEntity[];

  @ApiProperty({
    description: 'ID of the selected default avatar',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @Column({ type: 'uuid', nullable: true })
  defaultAvatarId?: string;

  @ApiProperty({
    description: 'Selected default avatar',
    type: () => DefaultAvatarEntity,
    required: false,
  })
  @ManyToOne(() => DefaultAvatarEntity, { nullable: true })
  @JoinColumn({ name: 'defaultAvatarId' })
  defaultAvatar?: DefaultAvatarEntity;

  @ApiProperty({
    description: 'Affiliate campaign ID that referred this user',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
    deprecated: true,
  })
  @Index()
  @Column({ type: 'uuid', nullable: true })
  // TODO: Remove affiliateCampaignId (used in 24 files) - replace all references with referralCode lookup
  // This field unnecessarily complicates data mapping (UUID → code conversion everywhere)
  // New referralCode field stores the code directly, eliminating need for joins
  affiliateCampaignId?: string;

  @ApiProperty({
    description: 'Referral code of the affiliate campaign',
    example: 'partner123',
    required: false,
  })
  @Index()
  @Column({ type: 'varchar', nullable: true })
  referralCode?: string;

  @ApiProperty({
    description: 'User preferred fiat format',
    enum: FiatFormatEnum,
    example: FiatFormatEnum.STANDARD,
    default: FiatFormatEnum.STANDARD,
  })
  @Column({
    type: 'enum',
    enum: FiatFormatEnum,
    default: FiatFormatEnum.STANDARD,
  })
  currentFiatFormat!: FiatFormatEnum;

  @ApiProperty({
    description: 'User preferred currency',
    enum: CurrencyEnum,
    example: CurrencyEnum.USD,
    default: CurrencyEnum.USD,
  })
  @Column({
    type: 'enum',
    enum: CurrencyEnum,
    default: CurrencyEnum.USD,
  })
  currentCurrency!: CurrencyEnum;

  @ApiProperty({
    description: 'Registration strategy',
    enum: AuthStrategyEnum,
    example: 'EMAIL',
  })
  @Column({
    type: 'enum',
    enum: AuthStrategyEnum,
  })
  registrationStrategy!: AuthStrategyEnum;

  @Exclude()
  @Column('jsonb')
  registrationData!: RegistrationDataType;

  @ApiProperty({
    description: 'Flag indicating if user is banned',
    example: false,
  })
  @Column({ default: false })
  isBanned!: boolean;

  @ApiProperty({
    description: 'Date and time when the mute expires (null if not muted)',
    example: '2025-06-12T12:00:00Z',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  mutedUntil?: Date | null;

  @ApiProperty({
    description: 'Reason for muting the user',
    example: 'Spam in chat',
    required: false,
  })
  @Column({ type: 'varchar', length: 500, nullable: true })
  muteReason?: string | null;

  @ApiProperty({
    description: 'Flag indicating if user profile is private (incognito mode)',
    example: false,
  })
  @Column({ default: false })
  isPrivate!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to receive marketing emails',
    example: true,
  })
  @Column({ default: true })
  emailMarketing!: boolean;

  @ApiProperty({
    description: 'Flag indicating if streamer mode is enabled (hides sensitive info)',
    example: false,
  })
  @Column({ default: false })
  streamerMode!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to be excluded from chat rain',
    example: false,
  })
  @Column({ default: false })
  excludeFromRain!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their statistics from public',
    example: false,
  })
  @Column({ default: false })
  hideStatistics!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their race statistics from public',
    example: false,
  })
  @Column({ default: false })
  hideRaceStatistics!: boolean;

  @ApiProperty({
    description: 'Flag indicating if two-factor authentication is enabled',
    example: false,
  })
  @Column({ default: false })
  is2FAEnabled!: boolean;

  @Exclude()
  @Column({ nullable: true })
  twoFactorSecret?: string;

  @ApiProperty({
    description: 'User creation timestamp',
    example: '2025-05-12T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt!: Date;

  @ApiProperty({
    description: 'User last update timestamp',
    example: '2025-05-12T12:30:00Z',
  })
  @UpdateDateColumn()
  updatedAt!: Date;

  @ApiProperty({
    description: 'Date and time when cookie consent was accepted',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  @Column({ type: 'timestamp', nullable: true })
  cookieConsentAcceptedAt?: Date;
}
