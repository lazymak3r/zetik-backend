import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskLevel } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumberString, IsOptional, IsString, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../../common/constants/error-messages';

export class PlacePlinkoBetDto {
  @ApiProperty({
    description: 'Bet amount as string (supports decimal precision)',
    example: '10.50',
    minimum: 0,
  })
  @IsNumberString({}, { message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  betAmount!: string;

  @ApiProperty({
    description:
      'Risk level affecting ONLY multiplier distribution (ball physics are pure 50/50 for all levels)',
    enum: RiskLevel,
    example: RiskLevel.MEDIUM,
  })
  @IsEnum(RiskLevel, { message: 'Invalid risk level' })
  riskLevel!: RiskLevel;

  @ApiProperty({
    description: 'Number of rows in Plinko board (8-16)',
    example: 16,
    minimum: 8,
    maximum: 16,
  })
  @Type(() => Number)
  @IsInt({ message: 'Row count must be an integer' })
  @Min(8, { message: 'Row count must be at least 8' })
  @Max(16, { message: 'Row count must be at most 16' })
  rowCount!: number;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
