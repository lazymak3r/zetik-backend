import { AssetTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsOptional } from 'class-validator';

export class GetBalanceStatisticsDto {
  @IsOptional()
  @IsEnum(AssetTypeEnum)
  asset?: AssetTypeEnum;
}
