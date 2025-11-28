import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, PlinkoGameStatus, RiskLevel } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class PlinkoGameResponseDto implements GameDisplayFields {
  @ApiProperty({
    description: 'Unique game ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
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
    description: 'Bet amount',
    example: '10.50',
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Risk level used',
    enum: RiskLevel,
    example: RiskLevel.MEDIUM,
  })
  riskLevel!: RiskLevel;

  @ApiProperty({
    description: 'Number of rows on the board',
    example: 16,
  })
  rowCount!: number;

  @ApiProperty({
    description: 'Bucket index where ball landed (0-based)',
    example: 8,
  })
  bucketIndex!: number;

  @ApiProperty({
    description: 'Multiplier for this bucket',
    example: '2.40',
  })
  multiplier!: string;

  @ApiProperty({
    description: 'Total win amount',
    example: '25.20',
  })
  winAmount!: string;

  @ApiProperty({
    description: 'Game status',
    enum: PlinkoGameStatus,
    example: PlinkoGameStatus.COMPLETED,
  })
  status!: PlinkoGameStatus;

  @ApiProperty({
    description: 'Client seed used for provably fair verification',
    example: 'my_custom_seed_123',
  })
  clientSeed!: string;

  @ApiProperty({
    description: 'Server seed hash for verification',
    example: 'a1b2c3d4e5f6...',
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: 'Nonce used for this game',
    example: 42,
  })
  nonce!: number;

  @ApiProperty({
    description: 'Optional ball path for animation replay',
    type: [Number],
    required: false,
    example: [8, 7, 8, 9, 8, 7, 8],
  })
  ballPath?: number[];

  @ApiProperty({
    description: 'Game creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt!: Date;

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

export class PlinkoConfigResponseDto {
  @ApiProperty({
    description: 'Available risk levels',
    enum: RiskLevel,
    isArray: true,
    example: [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH],
  })
  riskLevels!: RiskLevel[];

  @ApiProperty({
    description: 'Available row counts',
    type: [Number],
    example: [8, 9, 10, 11, 12, 13, 14, 15, 16],
  })
  rowCounts!: number[];

  @ApiProperty({
    description: 'Multiplier tables for each risk level and row count',
    type: 'object',
    additionalProperties: true,
    example: {
      LOW: {
        8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
        16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
      },
    },
  })
  multiplierTables!: Record<RiskLevel, Record<number, number[]>>;

  @ApiProperty({
    description: 'House edge percentage',
    example: 1.0,
  })
  houseEdge!: number;

  @ApiProperty({
    description: 'Dynamic game configuration settings',
    type: 'object',
    additionalProperties: true,
  })
  gameConfig?: {
    settings: any;
    version: number;
  };
}
