import { ApiProperty } from '@nestjs/swagger';
import { VerificationLevel, VerificationStatus } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class VerificationListQueryDto {
  @ApiProperty({
    description: 'Filter by verification status',
    enum: VerificationStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;

  @ApiProperty({
    description: 'Filter by verification level',
    enum: VerificationLevel,
    required: false,
  })
  @IsOptional()
  @IsEnum(VerificationLevel)
  level?: VerificationLevel;

  @ApiProperty({
    description: 'Filter by user ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({
    description: 'Number of results to return (max 100)',
    required: false,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    description: 'Number of results to skip',
    required: false,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number;
}
