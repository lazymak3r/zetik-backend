import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, DiceBetStatus, DiceBetType } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class DiceBetResponseDto implements GameDisplayFields {
  @ApiProperty({
    description: 'Unique bet identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User ID who placed the bet',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId!: string;

  @ApiProperty({
    description: 'User information who placed the bet',
    type: BetUserInfoDto,
    nullable: true,
  })
  user!: BetUserInfoDto | null;

  @ApiProperty({
    description: 'Bet amount in crypto',
    example: '0.001',
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Crypto asset type',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'Type of bet',
    enum: DiceBetType,
    example: DiceBetType.ROLL_OVER,
  })
  betType!: DiceBetType;

  @ApiProperty({
    description: 'Target number for the dice roll',
    example: '50.50',
  })
  targetNumber!: string;

  @ApiProperty({
    description: 'Multiplier applied to winning bets',
    example: '1.9604',
  })
  multiplier!: string;

  @ApiProperty({
    description: 'Win chance percentage',
    example: '49.50',
  })
  winChance!: string;

  @ApiProperty({
    description: 'Actual dice roll result',
    example: '75.25',
    required: false,
  })
  rollResult?: string;

  @ApiProperty({
    description: 'Bet status',
    enum: DiceBetStatus,
    example: DiceBetStatus.WON,
  })
  status!: DiceBetStatus;

  @ApiProperty({
    description: 'Win amount in crypto (0 if lost)',
    example: '0.00196',
  })
  winAmount!: string;

  @ApiProperty({
    description: 'Client seed used',
    example: 'my-random-seed-123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce for provably fair verification',
    example: 1,
  })
  nonce!: number;

  @ApiProperty({
    description: 'Server seed hash for provably fair verification',
    example: 'a1b2c3d4e5f6...',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Server seed (revealed after game ends)',
    example: 'server-secret-seed-xyz',
    nullable: true,
  })
  serverSeed!: string | null;

  @ApiProperty({
    description: 'When the bet was created',
    example: '2023-12-01T10:30:00Z',
  })
  createdAt!: Date;

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
