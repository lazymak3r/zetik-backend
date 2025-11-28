import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KenoRiskLevel } from '@zetik/shared-entities';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class PlaceKenoBetDto {
  @ApiProperty({
    description: 'Bet amount in crypto currency (string to maintain precision)',
    type: String,
    example: '0.001',
    minimum: 0.00000001,
  })
  @IsString()
  betAmount!: string;

  @ApiProperty({
    description: 'Array of selected numbers from 1 to 40',
    type: [Number],
    example: [5, 15, 25, 35, 40],
    minItems: 1,
    maxItems: 10,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(40, { each: true })
  selectedNumbers!: number[];

  @ApiProperty({
    description: 'Risk level that determines payout multipliers',
    enum: KenoRiskLevel,
    example: KenoRiskLevel.CLASSIC,
    enumName: 'KenoRiskLevel',
  })
  @IsEnum(KenoRiskLevel, { message: 'Invalid risk level' })
  riskLevel!: KenoRiskLevel;

  @ApiPropertyOptional({
    description: 'Game session identifier for tracking related bets (optional)',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  gameSessionId?: string;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
