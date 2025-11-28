import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class UpdateSeedPairDto {
  @ApiPropertyOptional({
    description: 'Server seed (64-character hex string)',
    example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  })
  @IsOptional()
  @IsString()
  @Length(64, 64, { message: 'Server seed must be exactly 64 characters' })
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'Server seed must be a valid 64-character hexadecimal string',
  })
  serverSeed?: string;

  @ApiPropertyOptional({
    description: 'Client seed',
    example: 'my-custom-client-seed',
  })
  @IsOptional()
  @IsString()
  clientSeed?: string;

  @ApiPropertyOptional({
    description: 'Nonce value (non-negative integer as string for BigInt support)',
    example: '0',
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convert number to string if needed for backward compatibility
    if (typeof value === 'number') {
      return value.toString();
    }
    return value;
  })
  @IsString()
  @Matches(/^\d+$/, { message: 'Nonce must be a non-negative integer string' })
  nonce?: string;

  @ApiPropertyOptional({
    description: 'Next server seed (64-character hex string)',
    example: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
  })
  @IsOptional()
  @IsString()
  @Length(64, 64, { message: 'Next server seed must be exactly 64 characters' })
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'Next server seed must be a valid 64-character hexadecimal string',
  })
  nextServerSeed?: string;

  @ApiPropertyOptional({
    description: 'Next server seed hash (automatically calculated if nextServerSeed is provided)',
    example: '8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9',
  })
  @IsOptional()
  @IsString()
  @Length(64, 64, { message: 'Next server seed hash must be exactly 64 characters' })
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'Next server seed hash must be a valid 64-character hexadecimal string',
  })
  nextServerSeedHash?: string;
}
