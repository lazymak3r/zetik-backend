import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

class WeeklyRacePrizeItemInput {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  place!: number;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  @Min(0)
  amount!: number; // USD
}

export class UpdateWeeklyRacePrizesInput {
  @ApiProperty({ type: [WeeklyRacePrizeItemInput] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyRacePrizeItemInput)
  prizes!: WeeklyRacePrizeItemInput[];
}
