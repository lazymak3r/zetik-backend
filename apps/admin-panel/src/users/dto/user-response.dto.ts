import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'User email',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
    required: false,
  })
  username?: string;

  @ApiProperty({
    description: 'Is user banned',
    example: false,
  })
  isBanned!: boolean;

  @ApiProperty({
    description: 'Is user profile private (incognito mode)',
    example: false,
  })
  isPrivate!: boolean;

  @ApiProperty({
    description: 'Is email verified',
    example: true,
  })
  isEmailVerified!: boolean;

  @ApiProperty({
    description: 'Current balance',
    example: '100.50',
  })
  currentBalance!: string;

  @ApiProperty({
    description: 'Total deposits',
    example: '500.00',
  })
  totalDeposits!: string;

  @ApiProperty({
    description: 'Total withdrawals',
    example: '200.00',
  })
  totalWithdrawals!: string;

  @ApiProperty({
    description: 'User creation date',
    example: '2025-05-12T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last login date',
    example: '2025-05-12T12:30:00Z',
    required: false,
  })
  lastLoginAt?: Date;
}
