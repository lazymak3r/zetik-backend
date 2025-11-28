import { ApiProperty } from '@nestjs/swagger';
import { RaceStatusEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class GetAffiliateRacesQueryDto {
  @ApiProperty({
    enum: RaceStatusEnum,
    required: false,
    example: RaceStatusEnum.ACTIVE,
    description:
      'ACTIVE: your current ACTIVE/PENDING races (max 1). ENDED: your ended races sorted DESC. No status: all your races.',
  })
  @IsOptional()
  @IsEnum(RaceStatusEnum)
  status?: RaceStatusEnum;

  @ApiProperty({
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
    description: 'Number of races to return (only YOUR created races)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    required: false,
    default: 0,
    minimum: 0,
    description: 'Offset for pagination',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
