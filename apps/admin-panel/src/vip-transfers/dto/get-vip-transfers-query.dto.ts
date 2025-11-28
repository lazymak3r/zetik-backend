import { ApiProperty } from '@nestjs/swagger';
import { VipTransferCasinoEnum, VipTransferTagEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GetVipTransfersQueryDto {
  @ApiProperty({ description: 'Page number', example: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ description: 'Filter by tag', enum: VipTransferTagEnum, required: false })
  @IsOptional()
  @IsEnum(VipTransferTagEnum)
  tag?: VipTransferTagEnum;

  @ApiProperty({ description: 'Filter by casino', enum: VipTransferCasinoEnum, required: false })
  @IsOptional()
  @IsEnum(VipTransferCasinoEnum)
  casino?: VipTransferCasinoEnum;

  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Start date (ISO string)', required: false })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiProperty({ description: 'End date (ISO string)', required: false })
  @IsOptional()
  @IsString()
  endDate?: string;
}
