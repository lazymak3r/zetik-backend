import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, GameTypeEnum } from '@zetik/shared-entities';
import { GameDisplayFields } from '../interfaces/game-display.interface';

export class UserBetDto implements GameDisplayFields {
  @ApiProperty({
    enum: GameTypeEnum,
    example: GameTypeEnum.DICE,
  })
  game!: GameTypeEnum;

  @ApiProperty({
    description: 'Human-readable game name',
    example: 'Dice',
    required: false,
  })
  gameName?: string;

  @ApiProperty({
    description: 'Bet ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  betId!: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId!: string;

  @ApiProperty({
    description: 'Bet amount',
    example: '100.50000000',
  })
  betAmount!: string;

  @ApiProperty({
    enum: AssetTypeEnum,
    example: AssetTypeEnum.USDC,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'Multiplier',
    example: '2.0000',
  })
  multiplier!: string;

  @ApiProperty({
    description: 'Payout amount',
    example: '201.00000000',
  })
  payout!: string;

  @ApiProperty({
    description: 'Bet creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Bet last update date',
    example: '2023-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Original fiat amount entered by user',
    example: '3000.00',
    required: false,
  })
  originalFiatAmount?: string;

  @ApiProperty({
    enum: CurrencyEnum,
    description: 'User selected fiat currency',
    example: CurrencyEnum.INR,
    required: false,
  })
  originalFiatCurrency?: CurrencyEnum;

  @ApiProperty({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
    required: false,
  })
  fiatToUsdRate?: string;

  @ApiProperty({
    description: 'Calculated fiat payout amount (multiplier × originalFiatAmount)',
    example: '6000.00',
    required: false,
  })
  payoutFiatAmount?: string;

  @ApiProperty({
    enum: CurrencyEnum,
    description: 'Fiat currency for payout',
    example: CurrencyEnum.INR,
    required: false,
  })
  payoutFiatCurrency?: CurrencyEnum;
}

export class UserBetResponseDto {
  @ApiProperty({
    description: 'Array of user bets',
    type: [UserBetDto],
  })
  bets!: UserBetDto[];

  @ApiProperty({
    description: 'Total number of bets',
    example: 150,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
  })
  limit!: number;

  @ApiProperty({
    description: 'Whether there are more pages available',
    example: true,
  })
  hasNext!: boolean;
}
