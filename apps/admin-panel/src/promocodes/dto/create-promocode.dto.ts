import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, VerificationLevel } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class EligibilityRulesDto {
  @ApiProperty({
    description: 'Minimum VIP level required (null = unranked allowed)',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Minimum rank cannot be negative' })
  @Max(100, { message: 'Minimum rank cannot exceed 100' })
  minRank?: number;

  @ApiProperty({
    description: 'Whether KYC verification is required',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  requireKyc?: boolean;

  @ApiProperty({
    description: 'Minimum KYC level required',
    enum: VerificationLevel,
    example: VerificationLevel.LEVEL_2_BASIC_INFO,
    required: false,
  })
  @IsOptional()
  @IsEnum(VerificationLevel)
  minKycLevel?: VerificationLevel;

  @ApiProperty({
    description: 'Array of allowed country codes',
    example: ['US', 'CA', 'GB'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2, { each: true, message: 'Country codes must be 2 characters' })
  allowedCountries?: string[];

  @ApiProperty({
    description: 'Array of excluded country codes',
    example: ['CN', 'RU'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2, { each: true, message: 'Country codes must be 2 characters' })
  excludedCountries?: string[];

  @ApiProperty({
    description: 'Array of required referral codes',
    example: ['FACEBOOK', 'TWITTER'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Referral codes cannot exceed 50 characters' })
  referralCodes?: string[];

  @ApiProperty({
    description: 'Maximum claims per user',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Per user limit must be at least 1' })
  @Max(100, { message: 'Per user limit cannot exceed 100' })
  perUserLimit?: number;

  @ApiProperty({
    description: 'Account must be created before this date',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  accountCreatedBefore?: Date;

  @ApiProperty({
    description: 'Allow only one claim per device',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  onePerDevice?: boolean;

  @ApiProperty({
    description: 'Allow only one claim per IP address',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  onePerIp?: boolean;
}

export class CreatePromocodeDto {
  @ApiProperty({
    description: 'Unique promocode',
    example: 'WELCOME2024',
  })
  @IsString()
  @MinLength(3, { message: 'Promocode must be at least 3 characters long' })
  @MaxLength(50, { message: 'Promocode must not exceed 50 characters' })
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'Promocode can only contain letters, numbers, underscores, and hyphens',
  })
  code!: string;

  @ApiProperty({
    description: 'Value per claim',
    example: 0.00001,
  })
  @IsNumber({}, { message: 'Value per claim must be a number' })
  @Min(0.00000001, { message: 'Value per claim must be at least 0.00000001' })
  @Max(1000000, { message: 'Value per claim cannot exceed 1,000,000' })
  @Type(() => Number)
  valuePerClaim!: number;

  @ApiProperty({
    description: 'Total number of available claims',
    example: 100,
  })
  @IsNumber({}, { message: 'Total claims must be a number' })
  @Min(1, { message: 'Total claims must be at least 1' })
  @Max(1000000, { message: 'Total claims cannot exceed 1,000,000' })
  @Type(() => Number)
  totalClaims!: number;

  @ApiProperty({
    description: 'Asset for the promocode',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'When promocode becomes active',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDate()
  @Type(() => Date)
  startsAt!: Date;

  @ApiProperty({
    description: 'When promocode expires',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDate()
  @Type(() => Date)
  endsAt!: Date;

  @ApiProperty({
    description: 'Internal note for admins',
    example: 'New Year promotion',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Note cannot exceed 500 characters' })
  note?: string;

  @ApiProperty({
    description: 'Eligibility rules for promocode access',
    type: EligibilityRulesDto,
  })
  @ValidateNested()
  @Type(() => EligibilityRulesDto)
  eligibilityRules!: EligibilityRulesDto;
}
