import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';

export class PromocodeResponseDto {
  @ApiProperty({
    description: 'Whether the redemption was successful',
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: 'Amount credited to user balance',
    example: '500',
    required: false,
  })
  amount?: string;

  @ApiProperty({
    description: 'Asset of the credited amount',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
    required: false,
  })
  asset?: AssetTypeEnum;

  @ApiProperty({
    description: 'Error message if redemption failed',
    example: 'Promocode not found',
    required: false,
  })
  error?: string;
}
