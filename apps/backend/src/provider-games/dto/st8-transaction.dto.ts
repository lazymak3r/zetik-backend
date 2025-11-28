import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { St8BonusStatusEnum, St8ProviderTransactionEnum } from '../enums/st8.enum';
import {
  ISt8BonusInfo,
  ISt8ProviderInfo,
  ISt8TransactionInput,
} from '../interfaces/st8-transaction.interface';

export class St8ProviderInfoDto implements ISt8ProviderInfo {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  transaction_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @ApiProperty({ nullable: true })
  @IsString()
  @IsOptional()
  player!: string | null;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  round?: string;
}

export class St8BonusInfoDto implements ISt8BonusInfo {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  instance_id!: string;

  @ApiProperty({ enum: St8BonusStatusEnum })
  @IsNotEmpty()
  @IsEnum(St8BonusStatusEnum)
  status!: St8BonusStatusEnum;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  bonus_id!: string;
}

export class St8TransactionDto implements ISt8TransactionInput {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  player!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  site!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  transaction_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  round!: string;

  @ApiProperty({ nullable: true })
  @IsBoolean()
  @IsOptional()
  round_closed!: boolean | null;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  game_code!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  developer_code!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @ApiProperty({ enum: St8ProviderTransactionEnum })
  @IsNotEmpty()
  @IsEnum(St8ProviderTransactionEnum)
  provider_kind!: St8ProviderTransactionEnum;

  @ApiProperty({ type: St8ProviderInfoDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => St8ProviderInfoDto)
  provider!: St8ProviderInfoDto;

  @ApiProperty({ type: St8BonusInfoDto, nullable: true })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => St8BonusInfoDto)
  bonus!: St8BonusInfoDto | null;
}
