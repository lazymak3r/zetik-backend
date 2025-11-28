import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token', example: 'uuid-token' })
  @IsString()
  token!: string;
}
