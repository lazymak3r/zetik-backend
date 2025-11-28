import { ApiProperty } from '@nestjs/swagger';
import { PlatformTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsOptional } from 'class-validator';

export class FilterSelfExclusionDto {
  @ApiProperty({
    description: 'Filter by platform type (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    required: false,
  })
  @IsOptional()
  @IsEnum(PlatformTypeEnum)
  platformType?: PlatformTypeEnum;
}
