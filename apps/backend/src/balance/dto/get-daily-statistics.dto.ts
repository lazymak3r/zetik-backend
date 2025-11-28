import { AssetTypeEnum } from '@zetik/shared-entities';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class GetDailyStatisticsDto {
  @IsOptional()
  @IsEnum(AssetTypeEnum)
  asset?: AssetTypeEnum;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
