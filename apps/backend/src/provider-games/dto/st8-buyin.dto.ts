import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { St8ProviderTransactionEnum } from '../enums/st8.enum';
import { ISt8BuyinInput } from '../interfaces/st8-buyin.interface';

class St8BuyinProviderDto {
  @IsString()
  @ApiProperty()
  transaction_id!: string;

  @IsString()
  @ApiProperty()
  amount!: string;

  @ApiProperty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true })
  player!: string | null;
}

export class St8BuyinDto implements ISt8BuyinInput {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  player!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  site!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  transaction_id!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  amount!: string;

  @IsNotEmpty()
  @ApiProperty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @IsString()
  @IsOptional()
  @ApiProperty({ nullable: true })
  game_code!: string | null;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  developer_code!: string;

  @IsEnum(St8ProviderTransactionEnum)
  @IsNotEmpty()
  @ApiProperty({ enum: St8ProviderTransactionEnum })
  provider_kind!: St8ProviderTransactionEnum;

  @IsNotEmpty()
  @ApiProperty({ type: St8BuyinProviderDto })
  provider!: St8BuyinProviderDto;
}
