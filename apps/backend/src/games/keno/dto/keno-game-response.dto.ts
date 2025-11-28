import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, KenoGameStatus, KenoRiskLevel } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class KenoGameResponseDto implements GameDisplayFields {
  @ApiProperty({
    description: 'Unique game identifier',
    type: String,
    format: 'uuid',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User information who placed the bet',
    type: BetUserInfoDto,
    nullable: true,
  })
  user!: BetUserInfoDto | null;

  @ApiPropertyOptional({
    description: 'Game session identifier for tracking related bets',
    type: String,
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  gameSessionId?: string;

  @ApiProperty({
    description: 'Bet amount in crypto currency',
    type: String,
    example: '0.001',
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Cryptocurrency type used for the bet',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
    enumName: 'AssetTypeEnum',
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'Current status of the game',
    enum: KenoGameStatus,
    example: KenoGameStatus.COMPLETED,
    enumName: 'KenoGameStatus',
  })
  status!: KenoGameStatus;

  @ApiProperty({
    description: 'Risk level used for this game',
    enum: KenoRiskLevel,
    example: KenoRiskLevel.CLASSIC,
    enumName: 'KenoRiskLevel',
  })
  riskLevel!: KenoRiskLevel;

  @ApiProperty({
    description: 'Numbers selected by the player (1-40)',
    type: [Number],
    example: [5, 15, 25, 35, 40],
    minItems: 1,
    maxItems: 10,
  })
  selectedNumbers!: number[];

  @ApiProperty({
    description: 'Numbers drawn by the game (10 numbers from 1-40)',
    type: [Number],
    example: [2, 5, 8, 12, 15, 18, 22, 25, 28, 31],
    minItems: 10,
    maxItems: 10,
  })
  drawnNumbers!: number[];

  @ApiProperty({
    description: 'Number of matches between selected and drawn numbers',
    type: Number,
    minimum: 0,
    maximum: 10,
    example: 4,
  })
  matches!: number;

  @ApiPropertyOptional({
    description: 'Win amount in crypto currency (null if no win)',
    type: String,
    example: '0.0165',
  })
  winAmount?: string;

  @ApiProperty({
    description: 'Payout multiplier applied to the bet',
    type: String,
    example: '16.5000',
  })
  payoutMultiplier!: string;

  @ApiProperty({
    description: 'Hash of the server seed (for provably fair verification)',
    type: String,
    example: 'a1b2c3d4e5f6789abc123def456...',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Client seed used for provably fair generation',
    type: String,
    example: 'my-custom-seed-123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Nonce used for provably fair generation',
    type: String,
    example: '1',
  })
  nonce!: string;

  @ApiPropertyOptional({
    description: 'Server seed revealed after game completion (for provably fair verification)',
    type: String,
    example: 'revealed-server-seed-abcdef123456',
  })
  serverSeed?: string; // Only revealed after game ends

  @ApiProperty({
    description: 'Game creation timestamp',
    type: String,
    format: 'date-time',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Game last update timestamp',
    type: String,
    format: 'date-time',
    example: '2024-01-15T10:30:01.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Original fiat amount entered by user',
    example: '3000.00',
    required: false,
  })
  originalFiatAmount?: string;

  @ApiPropertyOptional({
    enum: CurrencyEnum,
    description: 'Original fiat currency selected by user',
    example: CurrencyEnum.INR,
    required: false,
  })
  originalFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Calculated fiat payout amount (multiplier × originalFiatAmount)',
    example: '6000.00',
    required: false,
  })
  payoutFiatAmount?: string;

  @ApiPropertyOptional({
    enum: CurrencyEnum,
    description: 'Fiat currency for payout',
    example: CurrencyEnum.INR,
    required: false,
  })
  payoutFiatCurrency?: CurrencyEnum;

  @ApiPropertyOptional({
    description: 'Exchange rate used at time of bet',
    example: '83.45000000',
    required: false,
  })
  fiatToUsdRate?: string;
}
