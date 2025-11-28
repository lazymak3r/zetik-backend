import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';
import { CrashLeaderboardEntryDto } from './crash-leaderboard-entry.dto';

export class CrashBetDetailsResponseDto implements GameDisplayFields {
  @ApiProperty({
    description: 'Unique identifier of the bet',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'ID of the crash game',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  gameId!: string;

  @ApiProperty({
    description: 'User ID who placed the bet',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  userId!: string;

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
    description: 'Amount of the bet',
    example: '0.001',
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Auto cash out multiplier (if set)',
    example: '2.00',
    nullable: true,
  })
  autoCashOutAt?: string;

  @ApiProperty({
    description: 'Status of the bet',
    enum: ['ACTIVE', 'CASHED_OUT', 'CRASHED', 'CANCELLED'],
    example: 'CRASHED',
  })
  status!: string;

  @ApiProperty({
    description: 'Multiplier at which the bet was cashed out',
    example: '1.5',
    nullable: true,
  })
  cashOutAt?: string;

  @ApiProperty({
    description: 'Win amount from the bet',
    example: '0.0015',
    nullable: true,
  })
  winAmount?: string;

  @ApiProperty({
    description: 'Time when the bet was cashed out',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
  })
  cashOutTime?: Date;

  @ApiProperty({
    description: 'Point at which the game crashed',
    example: '1.23',
  })
  crashPoint!: string;

  @ApiProperty({
    description: 'Multiplier for this bet (0.00 for losses)',
    example: '0.00',
  })
  multiplier!: string;

  @ApiProperty({
    description: 'Payout amount (negative for losses)',
    example: '-0.001',
  })
  payout!: string;

  @ApiProperty({
    description: 'Total number of players in this game',
    example: 15,
  })
  totalPlayers!: number;

  @ApiProperty({
    description: 'Number of players who cashed out',
    example: 8,
  })
  cashedOutPlayers!: number;

  @ApiProperty({
    description: 'Total amount bet by all players',
    example: '0.5',
  })
  totalBetAmount!: string;

  @ApiProperty({
    description: 'Total amount won by all players',
    example: '0.3',
  })
  totalWinAmount!: string;

  @ApiProperty({
    description: 'Server seed hash for verification',
    example: 'abc123def456...',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Game index in the seed chain for verification',
    example: 1000,
  })
  gameIndex!: number;

  @ApiProperty({
    description: 'When the bet was placed',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    type: [CrashLeaderboardEntryDto],
    description: 'Game leaderboard sorted by winnings',
  })
  leaderboard!: CrashLeaderboardEntryDto[];

  @ApiProperty({
    description: 'Original fiat amount entered by user',
    example: '3000.00',
    required: false,
  })
  originalFiatAmount?: string;

  @ApiProperty({
    enum: CurrencyEnum,
    description: 'Original fiat currency selected by user',
    example: CurrencyEnum.INR,
    required: false,
  })
  originalFiatCurrency?: CurrencyEnum;

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

  @ApiProperty({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
    required: false,
  })
  fiatToUsdRate?: string;
}
