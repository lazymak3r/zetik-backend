import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class VerifyCrashOutcomeDto {
  @ApiProperty({
    description: 'Server seed from the game (revealed after crash)',
    example: '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b',
  })
  @IsString()
  serverSeed!: string;

  @ApiProperty({
    description: 'Game index in the seed chain (serves as nonce)',
    example: 9999999,
    minimum: 1,
    maximum: 10000000,
  })
  @IsInt()
  @Min(1)
  gameIndex!: number;

  @ApiProperty({
    description: 'Expected crash point to verify against (optional)',
    example: 2.45,
    minimum: 1.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1.0)
  crashPoint?: number;
}
