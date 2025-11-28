import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifySeedHashDto {
  @ApiProperty({
    description: 'Server seed hash to verify',
    example: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    minLength: 64,
    maxLength: 64,
  })
  @IsString()
  @Length(64, 64, { message: 'Server seed hash must be exactly 64 characters' })
  serverSeedHash!: string;
}
