import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class PlaceCrashBetDto {
  @ApiProperty({
    description: 'Amount to bet in crypto asset (e.g., BTC amount)',
    example: '0.00001',
  })
  @IsString({ message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  betAmount!: string;

  @ApiProperty({
    description: 'Auto cash out multiplier (optional)',
    example: 2.0,
    minimum: 1.01,
    maximum: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber({}, { message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @Min(1.01, { message: 'Auto cash out must be at least 1.01x' })
  @Max(1000, { message: 'Auto cash out cannot exceed 1000x' })
  @Type(() => Number)
  autoCashOutAt?: number;

  @ApiProperty({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
