import { ApiProperty } from '@nestjs/swagger';

export class SearchUsersVipLevelDto {
  @ApiProperty({ description: 'VIP level number', example: 1 })
  level!: number;

  @ApiProperty({ description: 'VIP level name', example: 'Bronze I' })
  name!: string;

  @ApiProperty({ description: 'VIP level image URL', required: false })
  imageUrl?: string;

  @ApiProperty({ description: 'Progress to next level in percentage (0-99)', example: 42 })
  percent!: number;
}

export class SearchUsersResponseDto {
  @ApiProperty({
    description: 'Username or display name',
    example: 'john_doe',
  })
  userName!: string;

  @ApiProperty({
    description: 'User ID - use this to get full profile via /v1/users/public/{userId}',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'User registration date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Avatar image URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'VIP level information',
    type: SearchUsersVipLevelDto,
  })
  vipLevel!: SearchUsersVipLevelDto;
}
