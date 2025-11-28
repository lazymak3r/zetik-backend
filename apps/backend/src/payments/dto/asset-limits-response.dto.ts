import { ApiProperty } from '@nestjs/swagger';

export class AssetLimitDto {
  @ApiProperty({ description: 'Minimum deposit amount' })
  MIN_DEPOSIT!: string;

  @ApiProperty({ description: 'Maximum deposit amount' })
  MAX_DEPOSIT!: string;

  @ApiProperty({ description: 'Minimum withdrawal amount' })
  MIN_WITHDRAW!: string;

  @ApiProperty({ description: 'Maximum withdrawal amount' })
  MAX_WITHDRAW!: string;

  @ApiProperty({ description: 'Daily withdrawal limit' })
  DAILY_WITHDRAW_LIMIT!: string;
}

export class AssetLimitsResponseDto {
  @ApiProperty({
    description: 'Map of asset symbols to operation limits',
    example: {
      BTC: {
        MIN_DEPOSIT: '0.00000001',
        MAX_DEPOSIT: '100',
        MIN_WITHDRAW: '0.0001',
        MAX_WITHDRAW: '10',
        DAILY_WITHDRAW_LIMIT: '50',
      },
      ETH: {
        MIN_DEPOSIT: '0.000001',
        MAX_DEPOSIT: '1000',
        MIN_WITHDRAW: '0.001',
        MAX_WITHDRAW: '100',
        DAILY_WITHDRAW_LIMIT: '500',
      },
    },
  })
  limits!: Record<string, AssetLimitDto>;
}
