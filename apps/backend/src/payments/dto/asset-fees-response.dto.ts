import { ApiProperty } from '@nestjs/swagger';

export class AssetFeesResponseDto {
  @ApiProperty({ description: 'Asset symbol' })
  asset!: string;

  @ApiProperty({ description: 'Estimated network fee' })
  networkFee!: string;

  @ApiProperty({ description: 'Cache timestamp' })
  cachedAt!: Date;
}

export class AssetFeesMapResponseDto {
  @ApiProperty({
    description: 'Map of asset symbols to fee estimates',
    example: {
      BTC: { asset: 'BTC', networkFee: '0.00009165', cachedAt: '2025-10-05T08:00:00.000Z' },
      ETH: { asset: 'ETH', networkFee: '0.00150000', cachedAt: '2025-10-05T08:00:00.000Z' },
    },
  })
  fees!: Record<string, AssetFeesResponseDto>;
}
