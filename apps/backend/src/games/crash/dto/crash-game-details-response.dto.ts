import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, CrashBetStatusEnum, CrashGameStatusEnum } from '@zetik/shared-entities';

export class UserBetDto {
  @ApiProperty({ enum: AssetTypeEnum, description: 'Asset type' })
  asset!: AssetTypeEnum;

  @ApiProperty({ description: 'Bet amount' })
  betAmount!: string;

  @ApiProperty({ description: 'Achieved multiplier' })
  multiplier!: string;

  @ApiProperty({ description: 'Payout amount' })
  payout!: string;

  @ApiProperty({ enum: CrashBetStatusEnum, description: 'Bet status' })
  status!: CrashBetStatusEnum;
}

export class CrashGameDetailsResponseDto {
  @ApiProperty({ description: 'Game ID' })
  id!: string;

  @ApiProperty({ enum: CrashGameStatusEnum, description: 'Game status' })
  status!: CrashGameStatusEnum;

  @ApiProperty({ description: 'Crash point' })
  crashPoint!: string;

  @ApiProperty({ description: 'Server seed hash' })
  serverSeedHash!: string;

  @ApiProperty({ description: 'Nonce/game index' })
  nonce!: string;

  @ApiProperty({
    description: 'Crash timestamp',
    required: false,
    nullable: true,
  })
  crashedAt?: Date;

  @ApiProperty({ description: 'Total players' })
  totalPlayers!: number;

  @ApiProperty({ description: 'Cashed out players' })
  cashedOutPlayers!: number;

  @ApiProperty({
    type: UserBetDto,
    description: 'User bet details if participated',
    required: false,
    nullable: true,
  })
  userBet?: UserBetDto;
}
