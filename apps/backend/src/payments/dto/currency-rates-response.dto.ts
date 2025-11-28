import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';

export class CurrencyRatesResponseDto {
  @ApiProperty({
    description: 'Currency rates in the specified base currency',
    example: {
      BTC: 45000,
      ETH: 3000,
      USDC: 1.0,
      USDT: 1.0,
      LTC: 180,
      DOGE: 0.08,
      TRX: 0.1,
      XRP: 0.6,
      SOL: 100,
    },
  })
  rates!: Record<string, number>;

  @ApiProperty({
    description: 'Timestamp when rates were last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;

  @ApiProperty({
    description: 'Base currency used for rates',
    enum: CurrencyEnum,
    example: CurrencyEnum.USD,
    default: CurrencyEnum.USD,
    required: false,
  })
  baseCurrency?: CurrencyEnum;
}
