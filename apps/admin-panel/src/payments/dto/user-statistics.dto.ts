import { ApiProperty } from '@nestjs/swagger';

export class UserStatisticsDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid-123',
  })
  userId!: string;

  @ApiProperty({
    description: 'Total number of deposits',
    example: 15,
  })
  totalDeposits!: number;

  @ApiProperty({
    description: 'Total deposit amount in USD',
    example: 5000.5,
  })
  totalDepositAmountUsd!: number;

  @ApiProperty({
    description: 'Total number of withdrawals',
    example: 8,
  })
  totalWithdrawals!: number;

  @ApiProperty({
    description: 'Total withdrawal amount in USD',
    example: 2500.25,
  })
  totalWithdrawalAmountUsd!: number;

  @ApiProperty({
    description: 'Number of pending withdrawal requests',
    example: 2,
  })
  pendingWithdrawals!: number;

  @ApiProperty({
    description: 'Account registration date',
    example: '2024-01-01T00:00:00.000Z',
  })
  registrationDate!: string;

  @ApiProperty({
    description: 'Last activity date',
    example: '2024-01-15T12:00:00.000Z',
  })
  lastActivity!: string;
}
