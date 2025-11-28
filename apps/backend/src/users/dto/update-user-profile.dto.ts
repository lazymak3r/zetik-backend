import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class UpdateUserProfileDto {
  @ApiProperty({
    description: 'Unique username (minimum 3 characters)',
    example: 'user123',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username?: string;

  @ApiProperty({
    description: 'User email address (for first-time add or update with 2FA)',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Display name for the user',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Display name cannot be empty' })
  displayName?: string;

  @ApiProperty({
    description: 'User bio/description (maximum 500 characters)',
    example: 'Love playing casino games and exploring new strategies!',
    required: false,
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    description: 'URL to user avatar image',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiProperty({
    description: 'User preferred fiat format',
    enum: FiatFormatEnum,
    example: FiatFormatEnum.STANDARD,
    required: false,
  })
  @IsOptional()
  @IsEnum(FiatFormatEnum)
  currentFiatFormat?: FiatFormatEnum;

  @ApiProperty({
    description: 'User preferred currency',
    enum: CurrencyEnum,
    example: CurrencyEnum.USD,
    required: false,
  })
  @IsOptional()
  @IsEnum(CurrencyEnum)
  currentCurrency?: CurrencyEnum;

  @ApiProperty({
    description: 'Flag indicating if user profile is private (incognito mode)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to receive marketing emails',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  emailMarketing?: boolean;

  @ApiProperty({
    description: 'Flag indicating if streamer mode is enabled (hides sensitive info)',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  streamerMode?: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to be excluded from chat rain',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeFromRain?: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their statistics from public',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hideStatistics?: boolean;

  @ApiProperty({
    description: 'Flag indicating if user wants to hide their race statistics from public',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  hideRaceStatistics?: boolean;
}
