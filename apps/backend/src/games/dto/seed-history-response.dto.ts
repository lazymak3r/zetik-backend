import { ApiProperty } from '@nestjs/swagger';

export class SeedHistoryItemDto {
  @ApiProperty({
    description: 'Unique ID of the seed pair',
    example: 123,
  })
  id!: number;

  @ApiProperty({
    description: 'Revealed server seed (only available for rotated pairs)',
    example: '1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z',
  })
  serverSeed!: string;

  @ApiProperty({
    description: 'Server seed hash that was shown during active period',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Client seed that was used',
    example: 'user_provided_seed_123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Final nonce count when the pair was rotated',
    example: '142',
  })
  nonce!: string;

  @ApiProperty({
    description: 'When the seed pair was created',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'When the seed pair was revealed/rotated',
    example: '2024-01-16T14:45:00.000Z',
  })
  revealedAt!: Date;

  @ApiProperty({
    description: 'Total number of games played with this seed pair',
    example: 142,
  })
  totalGames!: number;
}

export class SeedHistoryResponseDto {
  @ApiProperty({
    description: 'Array of historical seed pairs',
    type: [SeedHistoryItemDto],
  })
  seedPairs!: SeedHistoryItemDto[];

  @ApiProperty({
    description: 'Total number of historical seed pairs',
    example: 25,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Whether there are more pages available',
    example: true,
  })
  hasNext!: boolean;
}
