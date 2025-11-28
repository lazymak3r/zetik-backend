import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GameStatus, GameType } from '@zetik/shared-entities';

export class GameConfigAdminResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the game configuration',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id!: string;

  @ApiProperty({
    description: 'Type of the game',
    enum: GameType,
    example: GameType.CRASH,
  })
  gameType!: GameType;

  @ApiProperty({
    description: 'Status of the game configuration',
    enum: GameStatus,
    example: GameStatus.ENABLED,
  })
  status!: GameStatus;

  @ApiProperty({
    description: 'Display name of the game',
    example: 'Crash Game',
  })
  name!: string;

  @ApiPropertyOptional({
    description: 'Description of the game configuration',
    example: 'Multiplayer crash game with configurable betting time',
  })
  description?: string;

  @ApiPropertyOptional({
    description: 'Admin user who created this configuration',
    example: 'admin@example.com',
  })
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Admin user who last updated this configuration',
    example: 'admin@example.com',
  })
  updatedBy?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Minimum bet amount in USD',
    example: 0.1,
  })
  minBetUsd!: number;

  @ApiProperty({
    description: 'Maximum bet amount in USD',
    example: 1000.0,
  })
  maxBetUsd!: number;
}

export class GameConfigsListResponseDto {
  @ApiProperty({
    description: 'Array of game configurations',
    type: [GameConfigAdminResponseDto],
  })
  configs!: GameConfigAdminResponseDto[];

  @ApiProperty({
    description: 'Total number of configurations',
    example: 9,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of configurations per page',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 1,
  })
  totalPages!: number;
}

export class GameLiveStatsDto {
  @ApiProperty({
    description: 'Type of the game',
    enum: GameType,
    example: GameType.CRASH,
  })
  gameType!: GameType;

  @ApiProperty({
    description: 'Number of active players',
    example: 42,
  })
  activePlayers!: number;

  @ApiProperty({
    description: 'Number of active games',
    example: 3,
  })
  activeGames!: number;

  @ApiProperty({
    description: 'Total bets placed in last 24 hours',
    example: 1250,
  })
  betsLast24h!: number;

  @ApiProperty({
    description: 'Total volume in last 24 hours (in USD)',
    example: 25000.5,
  })
  volumeLast24h!: number;

  @ApiProperty({
    description: 'Revenue in last 24 hours (in USD)',
    example: 500.1,
  })
  revenueLast24h!: number;

  @ApiProperty({
    description: 'Average bet size in last 24 hours (in USD)',
    example: 20.0,
  })
  avgBetSizeLast24h!: number;

  @ApiProperty({
    description: 'House edge percentage achieved',
    example: 2.1,
  })
  actualHouseEdge!: number;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T12:30:00.000Z',
  })
  lastUpdated!: Date;
}

export class GameLiveStatsResponseDto {
  @ApiProperty({
    description: 'Live statistics for all games',
    type: [GameLiveStatsDto],
  })
  stats!: GameLiveStatsDto[];

  @ApiProperty({
    description: 'Timestamp of the statistics',
    example: '2024-01-01T12:30:00.000Z',
  })
  timestamp!: Date;
}

export class GetGameConfigsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of configurations per page',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by game type',
    enum: GameType,
    example: GameType.CRASH,
  })
  gameType?: GameType;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: GameStatus,
    example: GameStatus.ENABLED,
  })
  status?: GameStatus;

  @ApiPropertyOptional({
    description: 'Search term for name or description',
    example: 'crash',
  })
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'gameType',
    enum: ['gameType', 'name', 'status', 'createdAt', 'updatedAt'],
  })
  sortBy?: string = 'gameType';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'ASC',
    enum: ['ASC', 'DESC'],
  })
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
