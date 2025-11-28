import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BetType } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class RouletteBetDto {
  @ApiProperty({
    enum: BetType,
    description: 'Type of bet to place',
    example: BetType.STRAIGHT,
  })
  @IsEnum(BetType)
  type!: BetType;

  @ApiProperty({
    type: [Number],
    description: 'Numbers to bet on (0-36 for European roulette)',
    example: [7],
    minimum: 0,
    maximum: 36,
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  numbers!: number[];

  @ApiProperty({
    type: String,
    description: 'Bet amount as string (supports decimal precision)',
    example: '0.001',
  })
  @IsString()
  amount!: string;
}

export class PlaceRouletteBetDto {
  @ApiProperty({
    type: [RouletteBetDto],
    description: 'Array of bets to place',
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouletteBetDto)
  @ArrayMinSize(1)
  bets!: RouletteBetDto[];

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user (for display purposes)',
    example: '3000',
    required: false,
  })
  @IsOptional()
  @IsString()
  originalFiatAmount?: string;
}
