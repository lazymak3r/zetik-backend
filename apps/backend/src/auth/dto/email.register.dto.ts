import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class EmailRegisterDto {
  @ApiProperty({
    description: 'Email address for registration',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;

  @ApiProperty({
    description: 'Username (min 3 chars, alphanumeric with _ and -)',
    example: 'john_doe',
  })
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores and hyphens',
  })
  username!: string;

  @ApiProperty({
    description: 'Password (min 8 chars with uppercase, lowercase, and number)',
    example: 'Secret123',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @ApiProperty({
    description: 'Affiliate campaign ID or code for referral tracking',
    example: 'SUMMER2025',
    required: false,
  })
  @IsOptional()
  @IsString()
  affiliateCampaignId?: string;
}
