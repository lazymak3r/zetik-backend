import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class PlaceLimboBetDto {
  @ApiProperty({
    description: 'Bet amount in crypto asset',
    example: '0.001',
  })
  @IsString()
  betAmount!: string;

  @ApiProperty({
    description: 'Target multiplier for the limbo bet',
    minimum: 1.01,
    maximum: 1000000,
    example: 2.0,
  })
  @IsNumber()
  @Min(1.01)
  @Max(1000000)
  targetMultiplier!: number;

  @ApiPropertyOptional({
    description: 'Game session ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
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
