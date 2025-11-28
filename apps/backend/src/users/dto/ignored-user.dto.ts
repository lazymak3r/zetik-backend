import { ApiProperty } from '@nestjs/swagger';

export class IgnoredUserDto {
  @ApiProperty({
    description: 'Unique user ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  id!: string;

  @ApiProperty({
    description: 'Username',
    example: 'john_doe',
  })
  username!: string;

  @ApiProperty({
    description: 'Display name',
    example: 'John Doe',
    required: false,
  })
  displayName?: string;

  @ApiProperty({
    description: 'Avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'VIP level image path',
    example: 'user-level/silver-2"',
    required: false,
  })
  vipLevelImage?: string;

  @ApiProperty({
    description: 'When the user was ignored',
    example: '2025-05-12T12:00:00Z',
  })
  ignoredAt!: Date;
}
