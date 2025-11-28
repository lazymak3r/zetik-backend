import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';

export interface IUserRaceStatsDto {
  place: number | null;
  wagered: string;
  prize: number | null;
  asset: AssetTypeEnum | null;
  fiat: string | null;
}

export class UserRaceStatsDto implements IUserRaceStatsDto {
  @ApiProperty({ nullable: true, example: 5 })
  place!: number | null;

  @ApiProperty({ example: '1234.56', description: 'Wagered amount in USD' })
  wagered!: string;

  @ApiProperty({
    nullable: true,
    example: 1000,
    description: 'Prize in human-readable units (0.1 BTC or 1000 USD)',
  })
  prize!: number | null;

  @ApiProperty({ enum: AssetTypeEnum, nullable: true, example: null })
  asset!: AssetTypeEnum | null;

  @ApiProperty({ nullable: true, example: 'USD' })
  fiat!: string | null;
}
