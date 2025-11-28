import { ApiProperty } from '@nestjs/swagger';
import { PlatformTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

export class ExtendSelfExclusionDto {
  @ApiProperty({
    description: 'Platform type for the exclusion (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    example: PlatformTypeEnum.PLATFORM,
  })
  @IsEnum(PlatformTypeEnum)
  platformType!: PlatformTypeEnum;

  @ApiProperty({
    description:
      'Duration in days (1, 7, 30, 180) or omit for permanent exclusion. ' +
      '1 = 1 day, 7 = 1 week, 30 = 1 month, 180 = 6 months',
    example: 30,
    required: false,
  })
  @IsOptional()
  @IsIn([1, 7, 30, 180])
  durationDays?: 1 | 7 | 30 | 180;
}
