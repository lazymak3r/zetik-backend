import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import {
  BlackjackAction,
  BlackjackGameStatus,
  BlackjackPayoutRatio,
  Card,
  HandStatus,
} from '@zetik/shared-entities';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class BlackjackGameResponseDto implements GameDisplayFields {
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
    example: BlackjackGameStatus.ACTIVE,
  })
  status!: BlackjackGameStatus;

  @ApiProperty({
    description: "Player's cards in main hand",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: {
          type: 'string',
          example: 'hearts',
          enum: ['hearts', 'diamonds', 'clubs', 'spades'],
        },
        rank: {
          type: 'string',
          example: 'K',
          enum: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
        },
        value: { type: 'number', example: 10, minimum: 1, maximum: 11 },
      },
    },
    example: [
      { suit: 'hearts', rank: 'K', value: 10 },
      { suit: 'spades', rank: '7', value: 7 },
    ],
  })
  playerCards!: Card[];

  @ApiProperty({
    description: "Dealer's visible cards (only first card shown during active game)",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'diamonds' },
        rank: { type: 'string', example: 'A' },
        value: { type: 'number', example: 11 },
      },
    },
    example: [{ suit: 'diamonds', rank: 'A', value: 11 }],
  })
  dealerCards!: Card[];

  @ApiPropertyOptional({
    description: "Player's split hand cards (only present if split was performed)",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'clubs' },
        rank: { type: 'string', example: '8' },
        value: { type: 'number', example: 8 },
      },
    },
    example: [
      { suit: 'clubs', rank: '8', value: 8 },
      { suit: 'hearts', rank: '3', value: 3 },
    ],
  })
  splitCards?: Card[];

  @ApiProperty({
    description: "Player's split hand cards (always present, empty array when no split)",
    type: 'array',
    items: {
      type: 'object',
      properties: {
        suit: { type: 'string', example: 'clubs' },
        rank: { type: 'string', example: '8' },
        value: { type: 'number', example: 8 },
      },
    },
    example: [],
  })
  splitedCards!: Card[];

  @ApiProperty({
    description: 'Player main hand score (hard total)',
    example: 17,
    minimum: 0,
    maximum: 30,
  })
  playerScore!: number;

  @ApiProperty({
    description: 'Player main hand soft score (with aces as 11)',
    example: 17,
    minimum: 0,
    maximum: 30,
  })
  playerSoftScore!: number;

  @ApiProperty({
    description: 'Player split hand score (hard total)',
    example: 11,
    minimum: 0,
    maximum: 30,
  })
  splitScore!: number;

  @ApiProperty({
    description: 'Player split hand soft score (with aces as 11)',
    example: 11,
    minimum: 0,
    maximum: 30,
  })
  splitSoftScore!: number;

  @ApiProperty({
    description: 'Dealer score (hidden during active game)',
    example: 20,
    minimum: 0,
    maximum: 30,
  })
  dealerScore!: number;

  @ApiProperty({
    description: 'Dealer soft score (hidden during active game)',
    example: 20,
    minimum: 0,
    maximum: 30,
  })
  dealerSoftScore!: number;

  @ApiProperty({
    description: 'Whether player doubled down on main hand',
    example: false,
  })
  isDoubleDown!: boolean;

  @ApiProperty({
    description: 'Whether player doubled down on split hand',
    example: false,
  })
  isSplitDoubleDown!: boolean;

  @ApiProperty({
    description: 'Whether player took insurance',
    example: false,
  })
  isInsurance!: boolean;

  @ApiPropertyOptional({
    description: 'Insurance bet amount',
    example: '5.00',
    type: String,
  })
  insuranceBet?: string;

  @ApiPropertyOptional({
    description: 'Insurance bet winnings (0 if lost, 3x bet if won)',
    example: '15.00',
    type: String,
  })
  insuranceWin?: string;

  @ApiProperty({
    description: 'Whether player has split their hand',
    example: false,
  })
  isSplit!: boolean;

  @ApiProperty({
    description: "Status of player's main hand",
    enum: HandStatus,
    example: HandStatus.ACTIVE,
  })
  playerHandStatus!: HandStatus;

  @ApiPropertyOptional({
    description: "Status of player's split hand",
    enum: HandStatus,
    example: HandStatus.ACTIVE,
  })
  splitHandStatus?: HandStatus;

  @ApiProperty({
    description: 'Currently active hand (main or split)',
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
    description: '21+3 side bet amount',
    example: '10.00',
    type: String,
  })
  twentyOnePlusThreeBet?: string;

  @ApiPropertyOptional({
    description: 'Perfect Pairs side bet winnings',
    example: '0.00',
    type: String,
  })
  perfectPairsWin?: string;

  @ApiPropertyOptional({
    description: '21+3 side bet winnings',
    example: '0.00',
    type: String,
  })
  twentyOnePlusThreeWin?: string;

  @ApiPropertyOptional({
    description: 'Main hand win amount',
    example: '50.00',
    type: String,
  })
  winAmount?: string;

  @ApiProperty({
    description: 'Main hand payout multiplier (1.00 = push, 2.00 = win, 2.50 = blackjack)',
    example: '2.50',
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
    description: 'SHA256 hash of server seed (for provably fair verification)',
    example: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    pattern: '^[a-f0-9]{64}$',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Client seed used for random generation',
    example: 'my_custom_seed_123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce value for this game',
    example: '1',
  })
  nonce!: string;

  @ApiPropertyOptional({
    description: 'Server seed (only revealed after game completion for provably fair verification)',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  serverSeed?: string;

  @ApiProperty({
    description: 'Game creation timestamp',
    example: '2025-01-07T21:30:00.000Z',
    format: 'date-time',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Game last update timestamp',
    example: '2025-01-07T21:32:15.000Z',
    format: 'date-time',
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
    description: 'Available actions for current game state',
    type: 'array',
    items: { type: 'string', enum: Object.values(BlackjackAction) },
    example: ['hit', 'stand', 'double'],
  })
  availableActions!: BlackjackAction[];

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

  @ApiPropertyOptional({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
    required: false,
  })
  fiatToUsdRate?: string;
}
