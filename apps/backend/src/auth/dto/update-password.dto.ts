import { ApiProperty } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, Length, MinLength } from 'class-validator';

export interface IUpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class UpdatePasswordDto implements IUpdatePasswordInput {
  @ApiProperty({
    description: 'Current password',
    example: 'currentPassword123',
  })
  @IsString()
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (minimum 6 characters)',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters long' })
  newPassword!: string;

  @ApiProperty({
    required: false,
    description: '6-digit 2FA code (required if 2FA is enabled for the user)',
    example: '123456',
  })
  @IsOptional()
  @IsNumberString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  twoFactorCode?: string;
}
