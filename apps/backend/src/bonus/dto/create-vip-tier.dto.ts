import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDecimal,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVipTierDto {
  @ApiProperty({ minimum: 0, maximum: 100, description: 'VIP tier level' })
  @IsNumber()
  @Min(0)
  @Max(100)
  level!: number;

  @ApiProperty({ maxLength: 50, description: 'Tier name' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    required: false,
    maxLength: 500,
    description: 'Tier description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Is this a VIP tier',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isForVip?: boolean;

  @ApiProperty({ required: false, description: 'URL for tier image' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    description: 'Wager required to reach this level in cents',
  })
  @IsDecimal()
  @Min(0)
  wagerRequirement!: string;

  @ApiProperty({
    required: false,
    description: 'One-time bonus for reaching this level in cents',
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  levelUpBonusAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Rakeback percentage (0-100)',
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  @Max(100)
  rakebackPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Rank-up bonus amount in cents (first level of rank only)',
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  rankUpBonusAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Weekly bonus percentage of wager (0-100)',
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  @Max(100)
  weeklyBonusPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Monthly bonus percentage of wager (0-100)',
  })
  @IsOptional()
  @IsDecimal()
  @Min(0)
  @Max(100)
  monthlyBonusPercentage?: string;
}
