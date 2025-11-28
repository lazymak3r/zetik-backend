import { ApiProperty } from '@nestjs/swagger';

export class CampaignUserDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId!: string;

  @ApiProperty({
    description: 'User name',
    example: 'awesome_user',
  })
  username!: string;

  @ApiProperty({
    description: 'User registration date',
    example: '2023-01-01T00:00:00Z',
  })
  registeredAt!: Date;

  @ApiProperty({
    description: 'Total user deposits in cents',
    example: '100050',
  })
  totalDeposits!: string;

  @ApiProperty({
    description: 'Total commission (earnings) from this user in cents',
    example: '10005',
  })
  totalCommission!: string;

  @ApiProperty({
    description: 'Total wagered by this user in cents for the period',
    example: '250000',
  })
  totalWagered!: string;

  @ApiProperty({
    description: 'Earnings from this user for this campaign in cents (alias of totalCommission)',
    example: '10005',
  })
  earnings!: string;
}

export class CampaignUsersResponseDto {
  @ApiProperty({
    description: 'Campaign ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  campaignId!: string;

  @ApiProperty({
    description: 'Campaign name',
    example: 'Summer promotion',
  })
  campaignName!: string;

  @ApiProperty({
    description: 'Total commission for all users in cents',
    example: '150075',
  })
  totalCommission!: string;

  @ApiProperty({
    description: 'Total number of users',
    example: 100,
  })
  totalUsers!: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  currentPage!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 10,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Number of users per page',
    example: 10,
  })
  pageSize!: number;

  @ApiProperty({
    type: [CampaignUserDto],
    description: 'List of campaign users',
  })
  users!: CampaignUserDto[];
}
