import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class StartMinesGameDto {
  @ApiProperty({
    description:
      'Bet amount in the specified asset (0 for demo mode, minimum 0.00000001 for real bets)',
    example: '0.001',
    minimum: 0,
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
    description: 'Number of mines on the grid (1-24)',
    example: 3,
    minimum: 1,
    maximum: 24,
  })
  @IsInt({ message: 'Mines count must be an integer' })
  @Min(1, { message: 'Mines count must be at least 1' })
  @Max(24, { message: 'Mines count must be at most 24 for fair gameplay' })
  minesCount!: number;

  @ApiProperty({
    description: 'Game session ID for tracking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('all', { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  gameSessionId!: string;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
