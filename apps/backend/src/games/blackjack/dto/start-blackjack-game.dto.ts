import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartBlackjackGameDto {
  @ApiProperty({
    description: 'Main bet amount (asset determined by user primary currency)',
    example: '25.00',
    type: String,
    pattern: '^[0-9]+(.[0-9]{1,8})?$',
  })
  @IsString()
  betAmount!: string;

  @ApiPropertyOptional({
    description: 'Optional game session identifier for tracking related games',
    example: '550e8400-e29b-41d4-a716-446655440000',
    type: String,
    format: 'uuid',
  })
  @IsUUID()
  @IsOptional()
  gameSessionId?: string;

  @ApiPropertyOptional({
    description: 'Perfect Pairs side bet amount. Pays up to 25:1 for matching cards',
    example: '5.00',
    type: String,
    pattern: '^[0-9]+(.[0-9]{1,8})?$',
  })
  @IsString()
  @IsOptional()
  perfectPairsBet?: string;

  @ApiPropertyOptional({
    description: '21+3 side bet amount. Pays up to 100:1 for poker-style combinations',
    example: '10.00',
    type: String,
    pattern: '^[0-9]+(.[0-9]{1,8})?$',
  })
  @IsString()
  @IsOptional()
  twentyOnePlusThreeBet?: string;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
