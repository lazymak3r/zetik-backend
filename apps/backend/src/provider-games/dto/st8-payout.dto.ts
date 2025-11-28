import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { St8BonusStatusEnum, St8ProviderTransactionEnum } from '../enums/st8.enum';
import { ISt8PayoutInput } from '../interfaces/st8-payout.interface';

class St8PayoutProviderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @ApiProperty({ nullable: true })
  @IsString()
  @IsOptional()
  player!: string | null;
}

class St8PayoutBonusDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  instance_id!: string;

  @IsEnum(St8BonusStatusEnum)
  @IsNotEmpty()
  @ApiProperty({ enum: St8BonusStatusEnum })
  status!: St8BonusStatusEnum;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  bonus_id!: string;
}

export class St8PayoutDto implements ISt8PayoutInput {
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

  @ApiProperty()
  @IsEnum(CurrencyEnum)
  @IsNotEmpty()
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

  @ValidateNested()
  @Type(() => St8PayoutProviderDto)
  @IsNotEmpty()
  @ApiProperty({ type: St8PayoutProviderDto })
  provider!: St8PayoutProviderDto;

  @ValidateNested()
  @Type(() => St8PayoutBonusDto)
  @IsOptional()
  @ApiProperty({ type: St8PayoutBonusDto, nullable: true })
  bonus!: St8PayoutBonusDto | null;
}
