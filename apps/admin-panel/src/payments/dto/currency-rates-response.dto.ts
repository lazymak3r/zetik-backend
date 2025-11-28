import { ApiProperty } from '@nestjs/swagger';

export class CurrencyRatesResponseDto {
  @ApiProperty({
    description: 'Currency rates in USD',
    example: {
      BTC: 45000,
      ETH: 3000,
      USDC: 1.0,
      USDT: 1.0,
    },
  })
  rates!: Record<string, number>;

  @ApiProperty({
    description: 'Timestamp when rates were last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;
}
