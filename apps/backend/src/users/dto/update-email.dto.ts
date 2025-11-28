import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNumberString, IsOptional, Length } from 'class-validator';

export class UpdateEmailDto {
  @ApiProperty({
    description: 'New email address',
    example: 'newemail@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

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
