import { ApiProperty } from '@nestjs/swagger';

export class MultiCurrencyRatesResponseDto {
  @ApiProperty({
    description: 'Currency rates with multiple base currencies',
    example: {
      BTC: { USD: 45000, EUR: 38000, JPY: 6750000, CAD: 60750, CNY: 324000 },
      ETH: { USD: 3000, EUR: 2540, JPY: 450000, CAD: 4050, CNY: 21600 },
      USDC: { USD: 1.0, EUR: 0.85, JPY: 150, CAD: 1.35, CNY: 7.2 },
      USDT: { USD: 1.0, EUR: 0.85, JPY: 150, CAD: 1.35, CNY: 7.2 },
      LTC: { USD: 180, EUR: 153, JPY: 27000, CAD: 243, CNY: 1296 },
      DOGE: { USD: 0.08, EUR: 0.068, JPY: 12, CAD: 0.108, CNY: 0.576 },
      TRX: { USD: 0.1, EUR: 0.085, JPY: 15, CAD: 0.135, CNY: 0.72 },
      XRP: { USD: 0.6, EUR: 0.51, JPY: 90, CAD: 0.81, CNY: 4.32 },
      SOL: { USD: 100, EUR: 85, JPY: 15000, CAD: 135, CNY: 720 },
    },
  })
  rates!: Record<string, Record<string, number>>;

  @ApiProperty({
    description: 'Timestamp when rates were last updated',
    example: '2024-01-01T00:00:00.000Z',
  })
  lastUpdated!: string;

  @ApiProperty({
    description: 'Available fiat currencies in the response',
    example: ['USD', 'EUR', 'JPY', 'CAD', 'CNY'],
  })
  availableCurrencies!: string[];
}
