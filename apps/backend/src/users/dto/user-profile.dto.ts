import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import { AdminRole, AuthStrategyEnum } from '@zetik/shared-entities';
import { SelfExclusionResponseDto } from './self-exclusion-response.dto';

export class UserProfileDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'Username' })
  username!: string;

  @ApiProperty({ description: 'Email address', required: false })
  email?: string;

  @ApiProperty({ description: 'Flag indicating if email is verified', example: false })
  isEmailVerified!: boolean;

  @ApiProperty({ description: 'Phone number', required: false })
  phoneNumber?: string;

  @ApiProperty({ description: 'Flag indicating if phone is verified', example: false })
  isPhoneVerified!: boolean;

  @ApiProperty({ description: 'Display name', required: false })
  displayName?: string;

  @ApiProperty({ description: 'User bio/description', required: false })
  bio?: string;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string;

  @ApiProperty({ description: 'Referral code used during registration', required: false })
  referralCode?: string;

  @ApiProperty({ description: 'Registration date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Registration strategy' })
  registrationStrategy!: AuthStrategyEnum;

  @ApiProperty({ description: 'User preferred fiat format', enum: FiatFormatEnum })
  currentFiatFormat!: FiatFormatEnum;

  @ApiProperty({ description: 'User preferred currency', enum: CurrencyEnum })
  currentCurrency!: CurrencyEnum;

  @ApiProperty({ description: 'User VIP level', example: 1 })
  vipLevel!: number;

  @ApiProperty({ description: 'VIP level image path', required: false })
  vipLevelImage?: string;

  @ApiProperty({
    description: 'Flag indicating if user profile is private (incognito mode)',
    example: false,
  })
  isPrivate!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to receive marketing emails',
    example: true,
  })
  emailMarketing!: boolean;

  @ApiProperty({
    description: 'Flag indicating if streamer mode is enabled (hides sensitive info)',
    example: false,
  })
  streamerMode!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to be excluded from chat rain',
    example: false,
  })
  excludeFromRain!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their statistics from public',
    example: false,
  })
  hideStatistics!: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their race statistics from public',
    example: false,
  })
  hideRaceStatistics!: boolean;

  @ApiProperty({
    description: 'Active self-exclusion settings',
    type: [SelfExclusionResponseDto],
    required: false,
  })
  activeSelfExclusions?: SelfExclusionResponseDto[];

  @ApiProperty({
    description: 'Admin role (if user is admin or moderator)',
    enum: AdminRole,
    required: false,
  })
  role?: AdminRole;

  @ApiProperty({
    description: 'Cookie consent acceptance timestamp',
    required: false,
  })
  cookieConsentAcceptedAt?: Date;
}
