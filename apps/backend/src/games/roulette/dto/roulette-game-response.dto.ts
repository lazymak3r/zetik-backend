import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, BetType, RouletteColor } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class RouletteBetResponseDto implements GameDisplayFields {
  @ApiProperty({
    enum: BetType,
    description: 'Type of bet placed',
    example: BetType.STRAIGHT,
  })
  type!: BetType;

  @ApiProperty({
    type: [Number],
    description: 'Numbers that were bet on',
    example: [7],
  })
  numbers!: number[];

  @ApiProperty({
    type: String,
    description: 'Bet amount',
    example: '0.001',
  })
  amount!: string;

  @ApiProperty({
    type: String,
    description: 'Payout amount (only present if bet won)',
    example: '0.035',
    required: false,
  })
  payout?: string;

  @ApiPropertyOptional({
    description: 'Original fiat amount for this bet',
    example: '3000.00',
  })
  originalFiatAmount?: string;

  @ApiPropertyOptional({
    enum: CurrencyEnum,
    description: 'Original fiat currency',
    example: CurrencyEnum.INR,
  })
  originalFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
  })
  fiatToUsdRate?: string;
}

export class RouletteGameResponseDto {
  @ApiProperty({
    type: String,
    description: 'Unique game identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User information who placed the bet',
    type: BetUserInfoDto,
    nullable: true,
  })
  user!: BetUserInfoDto | null;

  @ApiProperty({
    description: 'Asset type used for the bet',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    type: [RouletteBetResponseDto],
    description: 'Array of bets placed in this game',
  })
  bets!: RouletteBetResponseDto[];

  @ApiProperty({
    type: String,
    description: 'Total amount bet',
    example: '0.005',
  })
  totalBetAmount!: string;

  @ApiProperty({
    type: Number,
    description: 'Winning number (0-36)',
    example: 7,
    nullable: true,
  })
  winningNumber!: number | null;

  @ApiProperty({
    enum: RouletteColor,
    description: 'Color of the winning number',
    example: RouletteColor.RED,
    nullable: true,
  })
  winningColor!: RouletteColor | null;

  @ApiProperty({
    type: String,
    description: 'Total payout',
    example: '0.175',
    nullable: true,
  })
  totalPayout!: string | null;

  @ApiProperty({
    type: String,
    description: 'Net profit/loss (negative for loss)',
    example: '0.170',
    nullable: true,
  })
  profit!: string | null;

  @ApiProperty({
    type: String,
    description: 'Overall game multiplier',
    example: '35.0000',
  })
  totalMultiplier!: string;

  @ApiProperty({
    type: Boolean,
    description: 'Whether the game is completed',
    example: true,
  })
  isCompleted!: boolean;

  @ApiProperty({
    type: String,
    description: 'Server seed hash for verification',
    example: 'a1b2c3d4e5f6...',
  })
  serverSeedHash!: string;

  @ApiProperty({
    type: String,
    description: 'Client seed used for this game',
    example: 'my-random-seed-123',
    nullable: true,
  })
  clientSeed!: string | null;

  @ApiProperty({
    type: Number,
    description: 'Nonce for this game',
    example: 1,
  })
  nonce!: number;

  @ApiProperty({
    type: Date,
    description: 'When the game was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Original fiat amount entered by user',
    example: '3000.00',
    required: false,
  })
  originalFiatAmount?: string;

  @ApiPropertyOptional({
    enum: CurrencyEnum,
    description: 'Original fiat currency selected by user',
    example: CurrencyEnum.INR,
  })
  originalFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Calculated fiat payout amount (multiplier × originalFiatAmount)',
    example: '6000.00',
  })
  payoutFiatAmount?: string;

  @ApiPropertyOptional({
    enum: CurrencyEnum,
    description: 'Fiat currency for payout',
    example: CurrencyEnum.INR,
  })
  payoutFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
  })
  fiatToUsdRate?: string;
}
