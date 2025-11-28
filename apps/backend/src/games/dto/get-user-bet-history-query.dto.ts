import { ApiProperty } from '@nestjs/swagger';
import { GameTypeEnum } from '@zetik/shared-entities';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum BetHistorySortEnum {
  DATE = 'date',
  AMOUNT = 'amount',
}

export class GetUserBetHistoryQueryDto {
  @ApiProperty({
    example: 1,
    description: 'Page number (default: 1)',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    example: 10,
    description: 'Number of bets to return (default: 10, max: 100)',
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({
    enum: GameTypeEnum,
    isArray: true,
    description: 'Filter by game type(s). Can be passed multiple times or comma-separated',
    example: [GameTypeEnum.DICE, GameTypeEnum.CRASH],
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',').map((v) => v.trim());
    return [value];
  })
  @IsArray()
  @IsEnum(GameTypeEnum, { each: true })
  gameTypes?: GameTypeEnum[];

  @ApiProperty({
    example: 'Dice',
    description: 'Filter by game name',
    required: false,
  })
  @IsOptional()
  @IsString()
  gameName?: string;

  @ApiProperty({
    enum: BetHistorySortEnum,
    description: 'Sort by date or amount (default: date)',
    example: BetHistorySortEnum.DATE,
    required: false,
  })
  @IsOptional()
  @IsEnum(BetHistorySortEnum)
  sortBy?: BetHistorySortEnum = BetHistorySortEnum.DATE;
}
