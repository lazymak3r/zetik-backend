import { ApiProperty } from '@nestjs/swagger';
import { CurrencyEnum } from '@zetik/common';
import { AssetTypeEnum, MinesGameStatus } from '@zetik/shared-entities';
import { BetUserInfoDto } from '../../dto/bet-user-info.dto';
import { GameDisplayFields } from '../../interfaces/game-display.interface';

export class MinesGameResponseDto implements GameDisplayFields {
  @ApiProperty({
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
    description: 'Game session identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  gameSessionId!: string;

  @ApiProperty({
    description: 'Bet amount',
    example: '0.001',
  })
  betAmount!: string;

  @ApiProperty({
    description: 'Asset type',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.USDC,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'Number of mines on the grid',
    example: 3,
  })
  minesCount!: number;

  @ApiProperty({
    description: 'Mine positions (only shown after game ends)',
    example: [2, 7, 15],
    nullable: true,
  })
  minePositions!: number[] | null;

  @ApiProperty({
    description: 'Currently revealed tile positions',
    example: [0, 1, 5, 12],
  })
  revealedTiles!: number[];

  @ApiProperty({
    description: 'Current win multiplier',
    example: '2.2500',
  })
  currentMultiplier!: string;

  @ApiProperty({
    description: 'Current potential payout',
    example: '0.00225',
  })
  potentialPayout!: string;

  @ApiProperty({
    description: 'Game status',
    enum: MinesGameStatus,
    example: MinesGameStatus.ACTIVE,
  })
  status!: MinesGameStatus;

  @ApiProperty({
    description: 'Final payout amount (null if game not completed)',
    example: '0.00225',
    nullable: true,
  })
  finalPayout!: string | null;

  @ApiProperty({
    description: 'Server seed hash for provably fair verification',
    example: 'a1b2c3d4e5f6...',
  })
  serverSeedHash!: string;

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
    description: 'Server seed (revealed after game ends)',
    example: 'server-secret-seed-xyz',
    nullable: true,
  })
  serverSeed!: string | null;

  @ApiProperty({
    description: 'Game creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
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
    example: '6750.00',
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
