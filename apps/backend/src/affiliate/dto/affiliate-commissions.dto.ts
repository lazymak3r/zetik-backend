import { ApiProperty } from '@nestjs/swagger';

export class AffiliateCommissionsResponseDto {
  @ApiProperty({
    description: 'Cryptocurrency balances available for claiming',
    example: {
      BTC: '0.00000325',
      LTC: '0.00324001',
      XRP: '0.12540070',
    },
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
  })
  crypto!: Record<string, string>;
}

export class AffiliateClaimResponseDto {
  @ApiProperty({
    description: 'Transferred amounts by cryptocurrency',
    example: {
      BTC: '0.00000325',
      LTC: '0.00324001',
      XRP: '0.12540070',
    },
    type: 'object',
    additionalProperties: {
      type: 'string',
    },
  })
  transferred!: Record<string, string>;

  @ApiProperty({
    description: 'Total number of cryptocurrencies transferred',
    example: 3,
  })
  totalTransferred!: number;
}

export class AffiliateCommissionDetailDto {
  @ApiProperty({
    description: 'Asset code (e.g., BTC, LTC)',
    example: 'BTC',
  })
  asset!: string;

  @ApiProperty({
    description: 'Total commission earned in native currency',
    example: '1.43580192',
  })
  commission!: string;

  @ApiProperty({
    description: 'Total amount already claimed in native currency',
    example: '1.43580192',
  })
  claimed!: string;

  @ApiProperty({
    description: 'Available amount to claim in native currency',
    example: '0.00000000',
  })
  claimable!: string;
}

export class AffiliateStatisticsResponseDto {
  @ApiProperty({
    description: 'Total number of referred users',
    example: 30,
  })
  totalReferrals!: number;

  @ApiProperty({
    description: 'Total amount wagered by referrals in USD',
    example: '300141.24',
  })
  totalWageredUsd!: string;

  @ApiProperty({
    description: 'Total amount deposited by referrals in USD',
    example: '300141.24',
  })
  totalDepositedUsd!: string;

  @ApiProperty({
    description: 'Total amount claimed to private wallet in USD',
    example: '10000000.00',
  })
  totalClaimedUsd!: string;

  @ApiProperty({
    description: 'Available amount to claim in USD',
    example: '0.39',
  })
  totalAvailableUsd!: string;

  @ApiProperty({
    description: 'Commission details per cryptocurrency',
    type: [AffiliateCommissionDetailDto],
  })
  commissions!: AffiliateCommissionDetailDto[];
}
