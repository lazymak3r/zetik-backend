import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token', example: 'uuid-token' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'New password (min 8 chars)', example: 'NewPass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
