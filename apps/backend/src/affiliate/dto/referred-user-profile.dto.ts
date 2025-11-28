import { ApiProperty } from '@nestjs/swagger';
import { PublicUserProfileDto } from '../../users/dto/public-user-profile.dto';

/**
 * BREAKING CHANGE (v2.0):
 * Removed TOTAL_EARNINGS from sort options.
 * Reason: totalEarnings requires crypto-to-USD conversion for all users, making it too slow.
 * Alternative: Use TOTAL_WAGERED for sorting (already in USD, fast with balance_statistics).
 * Frontend migration: Replace sortBy=totalEarnings with sortBy=totalWagered
 */
export enum ReferredUsersSortEnum {
  TOTAL_WAGERED = 'totalWagered',
  CREATED_AT = 'createdAt',
}

export class CampaignInfoDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  campaignId!: string;

  @ApiProperty({
    description: 'Campaign code',
    example: 'PROMO2024',
    required: false,
  })
  code?: string;

  @ApiProperty({
    description: 'Campaign creation date',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: Date;
}

export class ReferredUserProfileDto extends PublicUserProfileDto {
  @ApiProperty({
    description: 'Total earnings (commission) generated from this user in cents',
    example: 12575,
  })
  totalEarnings!: number;

  @ApiProperty({
    description: 'Total amount wagered by this user in cents',
    example: 245000,
  })
  totalWagered!: number;

  @ApiProperty({
    description: 'Campaign information that the user was referred through',
    type: CampaignInfoDto,
  })
  campaign?: CampaignInfoDto;
}

export class ReferredUsersResponseDto {
  @ApiProperty({
    description: 'Array of referred users with their profile and earnings information',
    type: [ReferredUserProfileDto],
  })
  users!: ReferredUserProfileDto[];

  @ApiProperty({
    description: 'Total number of referred users',
    example: 25,
  })
  totalUsers!: number;

  @ApiProperty({
    description: 'Total earnings from all referred users in cents',
    example: 125050,
  })
  totalEarnings!: number;

  @ApiProperty({
    description: 'Number of items to skip',
    example: 0,
  })
  offset!: number;

  @ApiProperty({
    description: 'Maximum number of items per page',
    example: 100,
  })
  limit!: number;

  @ApiProperty({
    description: 'Whether there are more items available',
    example: true,
  })
  hasMore!: boolean;
}
