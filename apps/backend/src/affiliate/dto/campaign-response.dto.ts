import { ApiProperty } from '@nestjs/swagger';

export class CampaignResponseDto {
  @ApiProperty({
    description: 'Unique campaign ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'User ID of the campaign creator',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer Promotion',
  })
  name!: string;

  @ApiProperty({
    description: 'Campaign description',
    example: 'Special promotion for summer 2023',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Human-friendly referral code (optional, unique)',
    example: 'SUMMER2025',
    required: false,
  })
  code?: string;

  @ApiProperty({
    description: 'Total commission earned from this campaign',
    example: '1250.50',
  })
  totalCommission!: string;

  @ApiProperty({
    description: 'Total number of referrals from this campaign',
    example: 25,
  })
  totalReferrals!: number;

  @ApiProperty({
    description: 'Total deposited by all referred users in USD',
    example: '5000.00',
  })
  totalDeposited!: string;

  @ApiProperty({
    description: 'Referral link for this campaign',
    example: 'https://example.com/?c=TEST_2025',
  })
  referralLink!: string;

  @ApiProperty({
    description: 'Campaign creation timestamp',
    example: '2023-05-12T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Campaign last update timestamp',
    example: '2023-05-12T12:30:00Z',
  })
  updatedAt!: Date;
}
