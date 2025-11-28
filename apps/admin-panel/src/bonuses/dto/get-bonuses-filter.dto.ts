import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class GetBonusesFilterDto {
  @ApiProperty({ required: false, example: 1, minimum: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({
    required: false,
    description: 'Comma-separated status values: PENDING,CLAIMED,EXPIRED,CANCELED',
    example: 'PENDING,CLAIMED',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({
    required: false,
    description: 'Comma-separated bonus types: LEVEL_UP,RAKEBACK,WEEKLY_AWARD,MONTHLY_AWARD',
    example: 'LEVEL_UP,RAKEBACK',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  @IsArray()
  @IsString({ each: true })
  bonusType?: string[];

  @ApiProperty({ required: false, description: 'Filter by specific user ID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    required: false,
    description: 'Start date (ISO string)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    required: false,
    description: 'End date (ISO string)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
