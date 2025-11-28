import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrashBetStatusEnum, CrashGameStatusEnum } from '@zetik/shared-entities';

export class CrashParticipantDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Username' })
  username!: string;

  @ApiPropertyOptional({ description: 'VIP level image URL' })
  vipLevelImageUrl?: string;

  @ApiProperty({ description: 'Bet amount' })
  betAmount!: string;

  @ApiProperty({ description: 'Bet asset (e.g., BTC, ETH)' })
  asset!: string;

  @ApiPropertyOptional({ description: 'Auto cash-out multiplier' })
  autoCashOutAt?: string;

  @ApiProperty({ enum: CrashBetStatusEnum, description: 'Bet status' })
  status!: CrashBetStatusEnum;
}

export class CrashGameWithUserResponseDto {
  @ApiProperty({ description: 'Game ID' })
  id!: string;

  @ApiProperty({ enum: CrashGameStatusEnum, description: 'Game status' })
  status!: CrashGameStatusEnum;

  @ApiPropertyOptional({ description: 'Final crash point (if crashed)' })
  crashPoint?: string;

  @ApiPropertyOptional({ description: 'Current multiplier (if flying)' })
  currentMultiplier?: string;

  @ApiPropertyOptional({ description: 'Time remaining in current phase (seconds)' })
  timeRemaining?: number;

  @ApiProperty({ description: 'Total number of bets in current game' })
  betsCount!: number;

  @ApiProperty({ description: 'Total bet amount in current game' })
  totalBetAmount!: string;

  @ApiProperty({ description: 'Server seed hash for provable fairness' })
  serverSeedHash!: string;

  @ApiProperty({ description: 'Game index/nonce' })
  gameIndex!: number;

  @ApiProperty({
    type: [CrashParticipantDto],
    description: 'All active participants in current game',
  })
  participants!: CrashParticipantDto[];
}
