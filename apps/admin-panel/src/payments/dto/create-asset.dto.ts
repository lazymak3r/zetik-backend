import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AssetTypeEnum {
  BTC = 'BTC',
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
  LTC = 'LTC',
  DOGE = 'DOGE',
  TRX = 'TRX',
  XRP = 'XRP',
  SOL = 'SOL',
}

export enum AssetStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export class CreateAssetDto {
  @ApiProperty({
    enum: AssetTypeEnum,
    description: 'Asset symbol',
    example: AssetTypeEnum.BTC,
  })
  @IsEnum(AssetTypeEnum)
  symbol!: AssetTypeEnum;

  @ApiProperty({
    enum: AssetStatusEnum,
    description: 'Initial asset status',
    example: AssetStatusEnum.ACTIVE,
    default: AssetStatusEnum.ACTIVE,
  })
  @IsEnum(AssetStatusEnum)
  status?: AssetStatusEnum;
}
