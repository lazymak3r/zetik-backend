import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsString, ValidateIf } from 'class-validator';
import { CRYPTO_ASSETS_CONFIG } from '../config/crypto-assets.config';
import { IsNetworkRequiredForAsset } from '../validators/network-required.validator';

export class GetDepositAddressDto {
  @ApiProperty({
    description: 'Asset type',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  @ApiPropertyOptional({
    description: 'Network for multi-network assets (required for USDC, USDT)',
    example: 'ethereum',
    enum: ['ethereum', 'bsc'],
  })
  @ValidateIf(
    (o: GetDepositAddressDto) => !!CRYPTO_ASSETS_CONFIG[o.asset]?.requiresNetworkSelection,
  )
  @IsString()
  @IsNetworkRequiredForAsset()
  network?: string;
}
