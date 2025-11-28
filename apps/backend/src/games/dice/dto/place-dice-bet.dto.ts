import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { DiceBetType } from '@zetik/shared-entities';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class PlaceDiceBetDto {
  @ApiProperty({
    description: 'Game session ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsString({ message: 'Invalid game session ID format' })
  @IsOptional()
  gameSessionId?: string;

  @ApiProperty({
    description: 'Bet amount (0 for demo mode, minimum 0.00000001 for real bets)',
    minimum: 0,
    example: '0.001',
  })
  @IsString({ message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @Transform(({ value }) => {
    // Handle null, undefined, or empty string
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException(ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD);
    }

    const amount = parseFloat(value);
    // Allow 0 for demo mode, but reject NaN and negative amounts
    if (isNaN(amount) || amount < 0) {
      throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
    }
    // Reject positive amounts below minimum (but allow 0 for demo mode)
    if (amount > 0 && amount < 0.00000001) {
      throw new BadRequestException(ERROR_MESSAGES.FINANCIAL.BET_AMOUNT_TOO_SMALL);
    }
    return value;
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Type of bet (roll over or roll under)',
    enum: DiceBetType,
    example: DiceBetType.ROLL_OVER,
  })
  @IsEnum(DiceBetType, { message: 'Invalid bet type. Must be ROLL_OVER or ROLL_UNDER' })
  betType!: DiceBetType;

  @ApiProperty({
    description: 'Target number for the dice roll (0.01-99.98)',
    minimum: 0.01,
    maximum: 99.98,
    example: 50.5,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.98)
  targetNumber?: number;

  @ApiProperty({
    description: 'Multiplier for the bet (1.0102x-9900x)',
    minimum: 1.0102,
    maximum: 9900,
    example: 2.0,
    required: false,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(1.0102)
  @Max(9900)
  multiplier?: number;

  @ApiProperty({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
