import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, RaceStatusEnum, RaceTypeEnum } from '@zetik/shared-entities';

export interface IRaceHistoryEntryDto {
  raceId: string;
  raceName: string;
  raceType: RaceTypeEnum;
  status: RaceStatusEnum;
  place: number;
  wagered: string;
  prize: number;
  asset: AssetTypeEnum | null;
  fiat: string | null;
  endedAt: string;
}

export class RaceHistoryEntryDto implements IRaceHistoryEntryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  raceId!: string;

  @ApiProperty({ example: 'Weekly Race 42' })
  raceName!: string;

  @ApiProperty({ enum: RaceTypeEnum, example: RaceTypeEnum.WEEKLY })
  raceType!: RaceTypeEnum;

  @ApiProperty({
    enum: RaceStatusEnum,
    example: RaceStatusEnum.ACTIVE,
    description: 'Race status (FINALIZING, ENDED)',
  })
  status!: RaceStatusEnum;

  @ApiProperty({ example: 5, description: 'User final place in the race (99 if no place awarded)' })
  place!: number;

  @ApiProperty({ example: '1234.56', description: 'Total wagered amount in USD' })
  wagered!: string;

  @ApiProperty({ example: 1000, description: 'Prize amount in race currency units' })
  prize!: number;

  @ApiProperty({ enum: AssetTypeEnum, nullable: true, example: null })
  asset!: AssetTypeEnum | null;

  @ApiProperty({ nullable: true, example: 'USD' })
  fiat!: string | null;

  @ApiProperty({ example: '2025-10-09T00:00:00Z', description: 'Race end timestamp' })
  endedAt!: string;
}

export interface IRaceHistoryResponseDto {
  history: IRaceHistoryEntryDto[];
  total: number;
  page: number;
  limit: number;
}

export class RaceHistoryResponseDto implements IRaceHistoryResponseDto {
  @ApiProperty({ type: [RaceHistoryEntryDto] })
  history!: RaceHistoryEntryDto[];

  @ApiProperty({ example: 25, description: 'Total number of races user participated in' })
  total!: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  page!: number;

  @ApiProperty({ example: 10, description: 'Number of items per page' })
  limit!: number;
}
