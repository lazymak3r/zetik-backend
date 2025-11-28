import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsString, IsUUID, Max, Min } from 'class-validator';

export class AutoplayMinesDto {
  @ApiProperty({
    description: 'Bet amount in crypto (0 for demo mode, minimum 0.00000001 for real bets)',
    example: '0.001',
    minimum: 0,
  })
  @IsString({ message: 'Bet amount must be a string' })
  @Transform(({ value }) => {
    // Handle null, undefined, or empty string
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('Bet amount is required');
    }

    const amount = parseFloat(value);
    // Allow 0 for demo mode, but reject NaN and negative amounts
    if (isNaN(amount) || amount < 0) {
      throw new BadRequestException(
        'Bet amount must be a valid positive number or 0 for demo mode',
      );
    }
    // Reject positive amounts below minimum (but allow 0 for demo mode)
    if (amount > 0 && amount < 0.00000001) {
      throw new BadRequestException('Bet amount must be at least 0.00000001 for real bets');
    }
    return value;
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Number of mines to place (1-24)',
    example: 3,
    minimum: 1,
    maximum: 24,
  })
  @IsNumber({}, { message: 'Mines count must be a number' })
  @Min(1, { message: 'Mines count must be at least 1' })
  @Max(24, { message: 'Mines count must be at most 24' })
  @Type(() => Number)
  minesCount!: number;

  @ApiProperty({
    description: 'Array of tile positions to reveal (0-24)',
    example: [0, 1, 2],
    type: [Number],
  })
  @IsArray({ message: 'Tile positions must be an array' })
  @IsNumber({}, { each: true, message: 'Each tile position must be a number' })
  @Min(0, { each: true, message: 'Tile position must be at least 0' })
  @Max(24, { each: true, message: 'Tile position must be at most 24' })
  @Type(() => Number)
  tilePositions!: number[];

  @ApiProperty({
    description: 'Game session ID for tracking',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString({ message: 'Game session ID must be a string' })
  @IsUUID(4, { message: 'Game session ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Game session ID is required' })
  gameSessionId!: string;
}
