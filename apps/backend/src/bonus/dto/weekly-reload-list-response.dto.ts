import { ApiProperty } from '@nestjs/swagger';
import { WeeklyReloadBonusDto } from './weekly-reload-bonus.dto';

export class WeeklyReloadListResponseDto {
  @ApiProperty({ type: [WeeklyReloadBonusDto] })
  data!: WeeklyReloadBonusDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
