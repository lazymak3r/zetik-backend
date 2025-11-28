import { ApiProperty } from '@nestjs/swagger';
import { PromocodeStatusEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePromocodeDto {
  @ApiProperty({
    description: 'New status for the promocode',
    enum: PromocodeStatusEnum,
    example: PromocodeStatusEnum.PAUSED,
    required: false,
  })
  @IsOptional()
  @IsEnum(PromocodeStatusEnum)
  status?: PromocodeStatusEnum;

  @ApiProperty({
    description: 'New end date for the promocode',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endsAt?: Date;

  @ApiProperty({
    description: 'Updated internal note',
    example: 'Updated promotion details',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;
}
