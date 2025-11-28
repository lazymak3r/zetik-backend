import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, RaceStatusEnum } from '@zetik/shared-entities';

export interface IRaceLeaderboardParticipant {
  place: number;
  user: {
    id: string;
    userName: string;
    levelImageUrl: string;
  } | null;
  wagered: string;
  prize: number;
}

export class RaceLeaderboardParticipantDto implements IRaceLeaderboardParticipant {
  @ApiProperty({ example: 1 })
  place!: number;

  @ApiProperty({
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      userName: 'Player123',
      levelImageUrl: 'https://example.com/level/1.png',
    },
    nullable: true,
    description: 'User info or null for placeholder positions',
  })
  user!: {
    id: string;
    userName: string;
    levelImageUrl: string;
  } | null;

  @ApiProperty({ example: '12345.67', description: 'Wagered amount in USD' })
  wagered!: string;

  @ApiProperty({ example: 5000, description: 'Prize in human-readable units (1 BTC or 5000 USD)' })
  prize!: number;
}

export interface IRaceLeaderboardDto {
  id: string;
  slug: string;
  name: string;
  status: RaceStatusEnum;
  startsAt: string;
  endTime: string;
  prizePool: number;
  winnersCount: number;
  asset: AssetTypeEnum | null;
  fiat: string | null;
  sponsorId: string | null;
  referralCode: string | null;
  participantsCount?: number;
  leaderboard: IRaceLeaderboardParticipant[];
}

export class RaceLeaderboardDto implements IRaceLeaderboardDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'zetik-weekly-race-40' })
  slug!: string;

  @ApiProperty({ example: 'Zetik Weekly Race #40' })
  name!: string;

  @ApiProperty({ enum: RaceStatusEnum, example: RaceStatusEnum.ACTIVE })
  status!: RaceStatusEnum;

  @ApiProperty({ example: '2025-10-02T00:00:00Z' })
  startsAt!: string;

  @ApiProperty({ example: '2025-10-09T00:00:00Z' })
  endTime!: string;

  @ApiProperty({ example: 10000, description: 'Prize pool in human-readable units' })
  prizePool!: number;

  @ApiProperty({ example: 10, description: 'Number of prize places' })
  winnersCount!: number;

  @ApiProperty({
    enum: AssetTypeEnum,
    nullable: true,
    example: null,
    description: 'Crypto asset for prizes (XOR with fiat)',
  })
  asset!: AssetTypeEnum | null;

  @ApiProperty({
    nullable: true,
    example: 'USD',
    description: 'Fiat currency for prizes (XOR with asset)',
  })
  fiat!: string | null;

  @ApiProperty({ nullable: true, example: null })
  sponsorId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  referralCode!: string | null;

  @ApiProperty({ required: false, example: 150 })
  participantsCount?: number;

  @ApiProperty({ type: [RaceLeaderboardParticipantDto] })
  leaderboard!: RaceLeaderboardParticipantDto[];
}
