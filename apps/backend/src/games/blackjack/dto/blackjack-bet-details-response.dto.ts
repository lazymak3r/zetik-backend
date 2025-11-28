import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import {
  BlackjackGameStatus,
  BlackjackPayoutRatio,
  Card,
  HandStatus,
} from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';

export class BlackjackBetDetailsResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the blackjack game',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id!: string;

  @ApiPropertyOptional({
    description: 'Optional game session identifier',
    example: '550e8400-e29b-41d4-a716-446655440001',
    format: 'uuid',
  })
  gameSessionId?: string;

  @ApiProperty({
    description:
      'Total bet amount including all bet types: main bet + split additional bet + insurance + Perfect Pairs + 21+3',
    example: '25.00',
    type: String,
  })
  betAmount!: string;

  @ApiPropertyOptional({
    description: 'Main bet amount only (per original hand before split/double)',
    example: '10.00',
    type: String,
  })
  mainBetAmount?: string;

  @ApiProperty({
    description: 'Asset type used for betting',
    example: 'USDT',
    enum: ['USDT', 'BTC', 'ETH'],
  })
  asset!: string;

  @ApiProperty({
    description: 'Current game status',
    enum: BlackjackGameStatus,
    example: BlackjackGameStatus.COMPLETED,
  })
  status!: BlackjackGameStatus;

  @ApiProperty({
    description: "Player's cards in main hand",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'hearts' },
        rank: { type: 'string', example: 'K' },
        value: { type: 'number', example: 10 },
      },
    },
    example: [
      { suit: 'hearts', rank: 'K', value: 10 },
      { suit: 'spades', rank: '7', value: 7 },
    ],
  })
  playerCards!: Card[];

  @ApiProperty({
    description: "Dealer's cards",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'diamonds' },
        rank: { type: 'string', example: 'A' },
        value: { type: 'number', example: 11 },
      },
    },
    example: [
      { suit: 'diamonds', rank: 'A', value: 11 },
      { suit: 'hearts', rank: '8', value: 8 },
    ],
  })
  dealerCards!: Card[];

  @ApiPropertyOptional({
    description: 'Split hand cards (only if game was split)',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'clubs' },
        rank: { type: 'string', example: '9' },
        value: { type: 'number', example: 9 },
      },
    },
  })
  splitCards?: Card[];

  @ApiProperty({
    description: "Player's main hand score",
    example: 17,
    minimum: 0,
    maximum: 30,
  })
  playerScore!: number;

  @ApiProperty({
    description: "Player's main hand soft score (with Ace as 1)",
    example: 17,
    minimum: 0,
    maximum: 30,
  })
  playerSoftScore!: number;

  @ApiPropertyOptional({
    description: 'Split hand score (only if game was split)',
    example: 20,
    minimum: 0,
    maximum: 30,
  })
  splitScore?: number;

  @ApiPropertyOptional({
    description: 'Split hand soft score (only if game was split)',
    example: 20,
    minimum: 0,
    maximum: 30,
  })
  splitSoftScore?: number;

  @ApiProperty({
    description: "Dealer's final score",
    example: 19,
    minimum: 0,
    maximum: 30,
  })
  dealerScore!: number;

  @ApiProperty({
    description: "Dealer's soft score (with Ace as 1)",
    example: 19,
    minimum: 0,
    maximum: 30,
  })
  dealerSoftScore!: number;

  @ApiProperty({
    description: 'Whether main hand was doubled down',
    example: false,
  })
  isDoubleDown!: boolean;

  @ApiPropertyOptional({
    description: 'Whether split hand was doubled down',
    example: false,
  })
  isSplitDoubleDown?: boolean;

  @ApiProperty({
    description: 'Whether insurance bet was placed',
    example: false,
  })
  isInsurance!: boolean;

  @ApiProperty({
    description: 'Whether the hand was split',
    example: false,
  })
  isSplit!: boolean;

  @ApiProperty({
    description: 'Status of the main hand',
    enum: HandStatus,
    example: HandStatus.COMPLETED,
  })
  playerHandStatus!: HandStatus;

  @ApiPropertyOptional({
    description: 'Status of the split hand (only if split)',
    enum: HandStatus,
    example: HandStatus.COMPLETED,
  })
  splitHandStatus?: HandStatus;

  @ApiProperty({
    description: 'Currently active hand',
    example: 'main',
    enum: ['main', 'split'],
  })
  activeHand!: string;

  @ApiPropertyOptional({
    description: 'Perfect Pairs side bet amount',
    example: '5.00',
    type: String,
  })
  perfectPairsBet?: string;

  @ApiPropertyOptional({
    description: 'Twenty-One Plus Three side bet amount',
    example: '5.00',
    type: String,
  })
  twentyOnePlusThreeBet?: string;

  @ApiPropertyOptional({
    description: 'Perfect Pairs side bet win amount',
    example: '30.00',
    type: String,
  })
  perfectPairsWin?: string;

  @ApiPropertyOptional({
    description: 'Twenty-One Plus Three side bet win amount',
    example: '50.00',
    type: String,
  })
  twentyOnePlusThreeWin?: string;

  @ApiPropertyOptional({
    description: 'Insurance bet amount',
    example: '12.50',
    type: String,
  })
  insuranceBet?: string;

  @ApiPropertyOptional({
    description: 'Insurance bet win amount',
    example: '25.00',
    type: String,
  })
  insuranceWin?: string;

  @ApiPropertyOptional({
    description: 'Main hand win amount',
    example: '50.00',
    type: String,
  })
  winAmount?: string;

  @ApiProperty({
    description: 'Main hand payout multiplier',
    example: '2.00',
    type: String,
  })
  payoutMultiplier!: string;

  @ApiPropertyOptional({
    description: 'Split hand win amount',
    example: '25.00',
    type: String,
  })
  splitWinAmount?: string;

  @ApiProperty({
    description: 'Split hand payout multiplier',
    example: '2.00',
    type: String,
  })
  splitPayoutMultiplier!: string;

  @ApiProperty({
    description: 'Server seed hash for provably fair verification',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Client seed used for the game',
    example: 'player_seed_123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce used for the game',
    example: '3',
    type: String,
  })
  nonce!: string;

  @ApiProperty({
    description: 'Game creation timestamp',
    example: '2025-01-07T21:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Game last update timestamp',
    example: '2025-01-07T21:32:15.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Payout ratios for different win types (only when game is completed with wins)',
    type: 'object',
    properties: {
      main: { type: 'string', example: '3:2', description: 'Main hand payout ratio' },
      split: { type: 'string', example: '1:1', description: 'Split hand payout ratio' },
      perfectPairs: { type: 'string', example: '6:1', description: 'Perfect Pairs side bet ratio' },
      twentyOnePlusThree: { type: 'string', example: '5:1', description: '21+3 side bet ratio' },
      insurance: { type: 'string', example: '2:1', description: 'Insurance bet ratio' },
    },
    example: {
      main: '3:2',
      split: '1:1',
      perfectPairs: '25:1',
    },
  })
  ratio?: BlackjackPayoutRatio;

  @ApiProperty({
    description: 'User information',
    type: BetUserInfoDto,
    nullable: true,
  })
  user!: BetUserInfoDto | null;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user',
    example: '25.00',
    type: String,
  })
  originalFiatAmount?: string;

  @ApiPropertyOptional({
    description: 'Original fiat currency',
    enum: CurrencyEnum,
    example: CurrencyEnum.USD,
  })
  originalFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Total bet amount in fiat (includes doubles, splits, insurance)',
    example: '50.00',
    type: String,
  })
  totalBetFiatAmount?: string;

  @ApiPropertyOptional({
    description: 'Calculated fiat payout amount',
    example: '60.00',
    type: String,
  })
  payoutFiatAmount?: string;

  @ApiPropertyOptional({
    description: 'Fiat payout currency',
    enum: CurrencyEnum,
    example: CurrencyEnum.USD,
  })
  payoutFiatCurrency?: CurrencyEnum;
}
