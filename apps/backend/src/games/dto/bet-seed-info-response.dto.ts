import { ApiProperty } from '@nestjs/swagger';

export class BetSeedInfoResponseDto {
  @ApiProperty({
    description: 'Server seed used for the bet',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  })
  serverSeed!: string;

  @ApiProperty({
    description: 'Client seed used for the bet',
    example: 'my_client_seed_123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce used for the bet',
    example: 1,
  })
  nonce!: number;

  @ApiProperty({
    description: 'Game outcome/result',
    example: 75.25,
  })
  outcome!: number;

  @ApiProperty({
    description: 'Whether the outcome is valid (provably fair verification)',
    example: true,
  })
  isValid!: boolean;

  @ApiProperty({
    description: 'Calculated outcome using provably fair algorithm',
    example: 75.25,
  })
  calculatedOutcome!: number;

  @ApiProperty({
    description: 'HMAC hash used for verification',
    example: 'abc123def456...',
  })
  hash!: string;
}
