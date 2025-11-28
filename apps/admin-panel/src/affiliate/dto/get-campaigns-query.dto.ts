import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class GetCampaignsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search must be at least 3 characters to prevent performance issues' })
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Search must be at least 3 characters to prevent performance issues' })
  campaignCode?: string;
}
