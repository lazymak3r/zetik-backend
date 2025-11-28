import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export enum WithdrawRequestStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SENT = 'SENT',
  FAILED = 'FAILED',
}

export class GetWithdrawRequestsDto {
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

  @ApiProperty({ description: 'Filter by status', enum: WithdrawRequestStatus, required: false })
  @IsOptional()
  @IsEnum(WithdrawRequestStatus)
  status?: WithdrawRequestStatus;

  @ApiProperty({ description: 'Filter by user ID', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'Filter by asset', example: 'BTC', required: false })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  asset?: string;
}
