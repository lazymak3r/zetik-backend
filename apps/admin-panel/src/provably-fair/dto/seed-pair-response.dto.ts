import { ApiProperty } from '@nestjs/swagger';

export class SeedPairResponseDto {
  @ApiProperty({ description: 'Seed pair ID' })
  id!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Server seed (revealed only after rotation)' })
  serverSeed!: string;

  @ApiProperty({ description: 'SHA256 hash of server seed' })
  serverSeedHash!: string;

  @ApiProperty({ description: 'Client seed' })
  clientSeed!: string;

  @ApiProperty({ description: 'Current nonce for this seed pair' })
  nonce!: string;

  @ApiProperty({ description: 'Next server seed (unrevealed)' })
  nextServerSeed!: string;

  @ApiProperty({ description: 'SHA256 hash of next server seed' })
  nextServerSeedHash!: string;

  @ApiProperty({ description: 'Whether this is the active seed pair' })
  isActive!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
