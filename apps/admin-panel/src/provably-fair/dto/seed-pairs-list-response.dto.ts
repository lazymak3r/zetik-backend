import { ApiProperty } from '@nestjs/swagger';
import { SeedPairResponseDto } from './seed-pair-response.dto';

export class SeedPairsListResponseDto {
  @ApiProperty({
    description: 'Array of seed pairs',
    type: [SeedPairResponseDto],
  })
  seedPairs!: SeedPairResponseDto[];

  @ApiProperty({ description: 'Total number of seed pairs' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit!: number;

  @ApiProperty({ description: 'Whether there are more pages' })
  hasNext!: boolean;
}
