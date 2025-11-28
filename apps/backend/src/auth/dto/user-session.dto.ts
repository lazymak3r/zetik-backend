import { ApiProperty } from '@nestjs/swagger';

export class UserSessionDto {
  @ApiProperty({
    description: 'Session ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Device information',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    nullable: true,
  })
  deviceInfo?: string;

  @ApiProperty({
    description: 'When the session expires',
    example: '2023-01-08T00:00:00.000Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Whether this is the current session',
    example: true,
  })
  isCurrentSession!: boolean;

  @ApiProperty({
    description: 'Whether this session is currently active (connected to WebSocket)',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'When the session was last used',
    example: '2023-01-05T12:34:56.789Z',
    nullable: true,
  })
  lastUse?: Date;

  @ApiProperty({
    description: 'IP address of the last session use',
    example: '192.168.1.1',
    nullable: true,
  })
  ipAddress?: string;

  @ApiProperty({
    description: 'Location based on IP address',
    example: 'New York, US',
    nullable: true,
  })
  location?: string;
}

export class UserSessionsResponseDto {
  @ApiProperty({
    description: 'List of user sessions',
    type: [UserSessionDto],
  })
  sessions!: UserSessionDto[];
}

export class DeleteSessionsResponseDto {
  @ApiProperty({
    description: 'Number of deleted sessions',
    example: 3,
  })
  deletedCount!: number;
}
