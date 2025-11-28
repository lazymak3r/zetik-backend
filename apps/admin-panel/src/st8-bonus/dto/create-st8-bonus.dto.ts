import { CurrencyEnum } from '@zetik/common';
import {
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum St8BonusType {
  FREE_BETS = 'free_bets',
  FREE_MONEY = 'free_money',
  BONUS_GAME = 'bonus_game',
}

export class CreateSt8BonusDto {
  @IsString()
  bonus_id!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  game_codes!: string[];

  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @IsString()
  value!: string;

  @IsEnum(St8BonusType)
  type!: St8BonusType;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  players!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;

  @IsOptional()
  @IsString()
  site?: string;

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number; // seconds
}
