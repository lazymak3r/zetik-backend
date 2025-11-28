import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, RaceStatusEnum } from '@zetik/shared-entities';

export interface IRaceDto {
  id: string;
  slug: string;
  name: string;
  status: RaceStatusEnum;
  prizePool: number;
  prizes: number[];
  asset: AssetTypeEnum | null;
  fiat: string | null;
  startsAt: string;
  endsAt: string;
  sponsorId: string | null;
  referralCode: string | null;
  participantsCount?: number;
}

export class RaceDto implements IRaceDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'erjis-weekly-race_1' })
  slug!: string;

  @ApiProperty({ example: "Erji's Weekly Race" })
  name!: string;

  @ApiProperty({ enum: RaceStatusEnum, example: RaceStatusEnum.ACTIVE })
  status!: RaceStatusEnum;

  @ApiProperty({
    example: 10000,
    description: 'Prize pool in human-readable units (1 BTC or 5000 USD)',
  })
  prizePool!: number;

  @ApiProperty({ example: [5000, 3000, 2000], description: 'Prizes in human-readable units' })
  prizes!: number[];

  @ApiProperty({
    enum: AssetTypeEnum,
    nullable: true,
    example: 'BTC',
    description: 'Crypto asset for prizes (XOR with fiat). Example crypto race: BTC, null for fiat',
  })
  asset!: AssetTypeEnum | null;

  @ApiProperty({
    nullable: true,
    example: null,
    description: 'Fiat currency for prizes (XOR with asset). Example fiat race: null, USD',
  })
  fiat!: string | null;

  @ApiProperty({ example: '2025-10-02T00:00:00Z' })
  startsAt!: string;

  @ApiProperty({ example: '2025-10-09T00:00:00Z' })
  endsAt!: string;

  @ApiProperty({ nullable: true, example: null })
  sponsorId!: string | null;

  @ApiProperty({ nullable: true, example: null })
  referralCode!: string | null;

  @ApiProperty({ required: false, example: 150 })
  participantsCount?: number;
}

export interface IRaceListDto {
  races: IRaceDto[];
}

export class RaceListDto implements IRaceListDto {
  @ApiProperty({ type: [RaceDto] })
  races!: RaceDto[];
}
