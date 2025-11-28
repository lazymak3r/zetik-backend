import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ISt8BalanceInput } from '../interfaces/st8-balance.interface';

export class St8BalanceDto implements ISt8BalanceInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  player!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  site!: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  token?: string;
}
