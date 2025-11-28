import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class GetUsersBalanceReportDto {
  @ApiProperty({
    description: 'Array of user IDs to get balance report for',
    example: ['user1', 'user2', 'user3'],
    maxItems: 100,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(100, { message: 'Cannot process more than 100 users at once' })
  userIds!: string[];

  @ApiProperty({
    description: 'Start date for the report period (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date for the report period (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsDateString()
  toDate!: string;
}

export class UserBalanceReportDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user123',
  })
  userId!: string;

  @ApiProperty({
    description: 'Total wagered amount during the period',
    example: '1500.50',
  })
  totalWager!: string;

  @ApiProperty({
    description: 'Total won amount during the period',
    example: '1200.25',
  })
  totalWins!: string;

  @ApiProperty({
    description: 'Net wagered amount (bets - refunds)',
    example: '1450.00',
  })
  netWager!: string;

  @ApiProperty({
    description: 'Total deposits during the period',
    example: '500.00',
  })
  totalDeposits!: string;

  @ApiProperty({
    description: 'Total withdrawals during the period',
    example: '200.00',
  })
  totalWithdrawals!: string;

  @ApiProperty({
    description: 'Number of transactions during the period',
    example: 45,
  })
  transactionCount!: number;

  @ApiProperty({
    description: 'Current VIP level of the user',
    example: 2,
    required: false,
  })
  @IsOptional()
  currentVipLevel?: number;
}

export class UsersBalanceReportResponseDto {
  @ApiProperty({
    description: 'Array of user balance reports',
    type: [UserBalanceReportDto],
  })
  @Type(() => UserBalanceReportDto)
  users!: UserBalanceReportDto[];

  @ApiProperty({
    description: 'Report period start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  fromDate!: string;

  @ApiProperty({
    description: 'Report period end date',
    example: '2024-01-31T23:59:59.999Z',
  })
  toDate!: string;

  @ApiProperty({
    description: 'Total number of users processed',
    example: 15,
  })
  totalUsers!: number;

  @ApiProperty({
    description: 'Report generation timestamp',
    example: '2024-02-01T10:30:00.000Z',
  })
  generatedAt!: string;
}
