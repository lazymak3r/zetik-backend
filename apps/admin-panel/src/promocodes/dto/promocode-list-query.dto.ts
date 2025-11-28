import { ApiProperty } from '@nestjs/swagger';
import { PromocodeStatusEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PromocodeListQueryDto {
  @ApiProperty({
    description: 'Filter by promocode status',
    enum: PromocodeStatusEnum,
    example: PromocodeStatusEnum.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(PromocodeStatusEnum)
  status?: PromocodeStatusEnum;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({
    description: 'Search promocodes by code',
    example: 'WELCOME',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}
