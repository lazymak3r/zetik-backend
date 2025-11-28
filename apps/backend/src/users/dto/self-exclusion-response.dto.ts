import { ApiProperty } from '@nestjs/swagger';
import { LimitPeriodEnum, PlatformTypeEnum, SelfExclusionTypeEnum } from '@zetik/shared-entities';

export class SelfExclusionResponseDto {
  @ApiProperty({
    description: 'Unique self-exclusion ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Self-exclusion type',
    enum: SelfExclusionTypeEnum,
    example: SelfExclusionTypeEnum.TEMPORARY,
  })
  type!: SelfExclusionTypeEnum;

  @ApiProperty({
    description: 'Platform type for the exclusion (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    example: PlatformTypeEnum.PLATFORM,
  })
  platformType!: PlatformTypeEnum;

  @ApiProperty({
    description: 'Period for limits (daily, weekly, monthly, session)',
    enum: LimitPeriodEnum,
    example: LimitPeriodEnum.DAILY,
    required: false,
  })
  period?: LimitPeriodEnum;

  @ApiProperty({
    description: 'Limit amount (for deposit and loss limits)',
    example: 1000,
    required: false,
  })
  limitAmount?: number | null;

  @ApiProperty({
    description: 'Start date of the exclusion',
    example: '2025-05-12T12:00:00Z',
  })
  startDate!: Date;

  @ApiProperty({
    description: 'End date of the exclusion (null for permanent exclusion)',
    example: '2025-06-12T12:00:00Z',
    required: false,
  })
  endDate?: Date;

  @ApiProperty({
    description: 'Is the exclusion currently active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Self-exclusion creation timestamp',
    example: '2025-05-12T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Self-exclusion last update timestamp',
    example: '2025-05-12T12:30:00Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Timestamp when user requested limit removal (24h countdown starts)',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  removalRequestedAt?: Date | null;

  @ApiProperty({
    description:
      'Timestamp marking end of 24h window after cooldown expires (for extension opportunity)',
    example: '2025-05-12T12:00:00Z',
    required: false,
  })
  postCooldownWindowEnd?: Date | null;

  @ApiProperty({
    description:
      'Indicates if the cooldown is in the post-cooldown window (24h after expiry) where user can extend to permanent/temporary exclusion',
    example: false,
  })
  isInPostCooldownWindow?: boolean;

  @ApiProperty({
    description:
      'Indicates if a limit removal is pending (user clicked "Remove" and 24h countdown has started)',
    example: false,
  })
  isRemovalPending?: boolean;

  @ApiProperty({
    description: 'Timestamp when the 24h removal countdown expires and limit will be deleted',
    example: '2025-05-13T12:00:00Z',
    required: false,
  })
  removalExpiresAt?: Date | null;
}
