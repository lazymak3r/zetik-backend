import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateVipTierDto {
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
    description: 'Wager required to reach this level in dollars',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'wagerRequirement must be a valid decimal number',
  })
  wagerRequirement!: string;

  @ApiProperty({
    required: false,
    description: 'One-time bonus for reaching this level in dollars',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'levelUpBonusAmount must be a valid decimal number',
  })
  levelUpBonusAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Rakeback percentage (0-100)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/, {
    message: 'rakebackPercentage must be a valid percentage (0-100)',
  })
  rakebackPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Rank-up bonus amount in dollars (nullable per admin control)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'rankUpBonusAmount must be a valid decimal number',
  })
  rankUpBonusAmount?: string;

  @ApiProperty({
    required: false,
    description: 'Weekly bonus percentage of wager (0-100)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/, {
    message: 'weeklyBonusPercentage must be a valid percentage (0-100)',
  })
  weeklyBonusPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Monthly bonus percentage of wager (0-100)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/, {
    message: 'monthlyBonusPercentage must be a valid percentage (0-100)',
  })
  monthlyBonusPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Weekly reload percentage for profitable players (0-100)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/, {
    message: 'weeklyReloadProfitablePercentage must be a valid percentage (0-100)',
  })
  weeklyReloadProfitablePercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Weekly reload percentage for losing players (0-100)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/, {
    message: 'weeklyReloadLosingPercentage must be a valid percentage (0-100)',
  })
  weeklyReloadLosingPercentage?: string;

  @ApiProperty({
    required: false,
    description: 'Minimum daily weekly reload amount in dollars',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'weeklyReloadDailyMin must be a valid decimal amount',
  })
  weeklyReloadDailyMin?: string;
}
