import { ApiProperty } from '@nestjs/swagger';

export class VerifySeedHashResponseDto {
  @ApiProperty({
    description: 'Whether the seed is currently active',
    example: false,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'The revealed server seed (only if inactive)',
    example: 'abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234',
    required: false,
  })
  serverSeed?: string;

  @ApiProperty({
    description: 'Error message if verification failed or seed is active',
    example: 'Seed is still being used and cannot be revealed',
    required: false,
  })
  error?: string;
}
