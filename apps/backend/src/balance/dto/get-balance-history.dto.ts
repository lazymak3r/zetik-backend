import { AssetTypeEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { PAGE_LIMIT } from '../../common/constants/constants';

export enum BalanceHistorySortEnum {
  DATE = 'date',
  AMOUNT = 'amount',
}

export class GetBalanceHistoryDto {
  @IsOptional()
  @IsEnum(AssetTypeEnum)
  asset?: AssetTypeEnum;

  @IsOptional()
  @IsEnum(BalanceOperationEnum, { each: true })
  operation?: BalanceOperationEnum | BalanceOperationEnum[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(PAGE_LIMIT)
  limit?: number = PAGE_LIMIT;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(BalanceHistorySortEnum)
  sortBy?: BalanceHistorySortEnum = BalanceHistorySortEnum.DATE;
}
