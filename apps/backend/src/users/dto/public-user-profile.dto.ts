import { ApiProperty } from '@nestjs/swagger';
import { ModerationActionTypeEnum } from '@zetik/shared-entities';

export class AdminActionHistoryItemDto {
  @ApiProperty({
    description: 'Moderation history record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Type of moderation action',
    enum: ModerationActionTypeEnum,
    example: ModerationActionTypeEnum.MUTE,
  })
  actionType!: ModerationActionTypeEnum;

  @ApiProperty({
    description: 'Reason for the moderation action',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: 'Duration of the action in minutes',
    example: 60,
  })
  durationMinutes!: number;

  @ApiProperty({
    description: 'When the moderation action was created',
    example: '2025-05-12T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Admin ID who performed the action',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  adminId!: string;

  @ApiProperty({
    description: 'Admin username',
    example: 'admin_user',
  })
  adminUsername!: string;

  @ApiProperty({
    description: 'Admin display name',
    required: false,
  })
  adminDisplayName?: string;
}

export class PublicVipLevelDto {
  @ApiProperty({ description: 'VIP level number', example: 1 })
  level!: number;

  @ApiProperty({ description: 'VIP level name', example: 'Bronze I' })
  name!: string;

  @ApiProperty({ description: 'VIP level image URL', required: false })
  imageUrl?: string;

  @ApiProperty({ description: 'Progress to next level in percentage (0-99)', example: 42 })
  percent!: number;
}

export class PublicStatisticsDto {
  @ApiProperty({ description: 'Total number of bets placed', example: 142 })
  totalBets!: number;

  @ApiProperty({ description: 'Number of winning bets', example: 58 })
  numberOfWins!: number;

  @ApiProperty({ description: 'Number of losing bets', example: 84 })
  numberOfLosses!: number;

  @ApiProperty({ description: 'Total amount wagered in USD', example: '1791591.28' })
  wagered!: string;
}

export class PublicUserProfileDto {
  @ApiProperty({ description: 'Username' })
  userName!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Registration date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Avatar URL', required: false })
  avatarUrl?: string;

  @ApiProperty({ description: 'VIP level information', type: PublicVipLevelDto })
  vipLevel!: PublicVipLevelDto;

  @ApiProperty({ description: 'User statistics', type: PublicStatisticsDto, required: false })
  statistics?: PublicStatisticsDto;

  @ApiProperty({ description: 'Whether statistics are hidden', example: false })
  hideStatistics!: boolean;

  @ApiProperty({ description: 'Whether race statistics are hidden', example: false })
  hideRaceStatistics!: boolean;

  @ApiProperty({
    description: 'Admin action history (mutes and bans)',
    type: [AdminActionHistoryItemDto],
    required: false,
  })
  adminActionHistory?: AdminActionHistoryItemDto[];

  @ApiProperty({ description: 'Whether user is banned', example: false, required: false })
  isBanned?: boolean;

  @ApiProperty({ description: 'Mute expiration date', required: false })
  mutedUntil?: Date | null;

  @ApiProperty({ description: 'Cookie consent acceptance timestamp', required: false })
  cookieConsentAcceptedAt?: Date;
}
