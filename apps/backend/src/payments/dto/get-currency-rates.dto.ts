import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { IsEnum, IsOptional } from 'class-validator';

export class GetCurrencyRatesDto {
  @ApiProperty({
    description: 'Base currency for rates (default: USD)',
    enum: CurrencyEnum,
    required: false,
    default: CurrencyEnum.USD,
  })
  @IsOptional()
  @IsEnum(CurrencyEnum)
  baseCurrency?: CurrencyEnum = CurrencyEnum.USD;
}
