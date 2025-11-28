import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';

export class NetworkOptionDto {
  @ApiProperty({ description: 'Network identifier', example: 'ethereum' })
  id!: string;

  @ApiProperty({ description: 'Network display name', example: 'Ethereum' })
  name!: string;

  @ApiProperty({ description: 'Network description', example: 'ERC-20 token' })
  description!: string;
}

export class AvailableAssetDto {
  @ApiProperty({ description: 'Asset symbol', example: 'BTC' })
  symbol!: AssetTypeEnum;

  @ApiProperty({ description: 'Asset name', example: 'Bitcoin' })
  name!: string;

  @ApiProperty({ description: 'Number of decimal places', example: 8 })
  decimals!: number;

  @ApiProperty({ description: 'Whether network selection is required', example: false })
  requiresNetworkSelection!: boolean;

  @ApiProperty({
    description: 'Available networks for this asset',
    type: [NetworkOptionDto],
    required: false,
  })
  networks?: NetworkOptionDto[];
}

export class AvailableAssetsResponseDto {
  @ApiProperty({
    description: 'List of available assets',
    type: [AvailableAssetDto],
  })
  assets!: AvailableAssetDto[];
}
