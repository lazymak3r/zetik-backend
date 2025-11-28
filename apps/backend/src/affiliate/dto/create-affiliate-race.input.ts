import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum, RaceDurationEnum } from '@zetik/shared-entities';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface ICreateAffiliateRaceInput {
  referralCode: string;
  raceDuration: RaceDurationEnum;
  asset?: AssetTypeEnum | null;
  fiat?: string | null;
  prizes: number[];
}

@ValidatorConstraint({ name: 'assetOrFiatConstraint' })
class AssetOrFiatConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const obj = args.object as ICreateAffiliateRaceInput;
    const hasAsset = obj.asset !== null && obj.asset !== undefined;
    const hasFiat = obj.fiat !== null && obj.fiat !== undefined;
    return (hasAsset && !hasFiat) || (!hasAsset && hasFiat);
  }

  defaultMessage() {
    return 'Must provide either asset or fiat, not both and not neither';
  }
}

export class CreateAffiliateRaceInput implements ICreateAffiliateRaceInput {
  @ApiProperty({ example: 'ERJI123' })
  @IsString()
  @Length(3, 20)
  @Matches(/^[A-Z0-9_-]+$/i, {
    message: 'Referral code can only contain letters, numbers, underscore and dash',
  })
  referralCode!: string;

  @ApiProperty({
    enum: RaceDurationEnum,
    example: RaceDurationEnum.SEVEN_DAYS,
    description: 'Race duration',
  })
  @IsEnum(RaceDurationEnum)
  raceDuration!: RaceDurationEnum;

  @ApiProperty({
    enum: AssetTypeEnum,
    nullable: true,
    required: false,
    example: 'BTC',
    description: 'Asset for crypto prizes (XOR with fiat)',
  })
  @IsOptional()
  @IsEnum(AssetTypeEnum)
  @ValidateIf((o) => o.fiat === null || o.fiat === undefined)
  @Validate(AssetOrFiatConstraint)
  asset?: AssetTypeEnum | null;

  @ApiProperty({
    nullable: true,
    required: false,
    example: null,
    description: 'Fiat currency for prizes (XOR with asset)',
  })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.asset === null || o.asset === undefined)
  fiat?: string | null;

  @ApiProperty({
    example: [1, 0.5, 0.25],
    description:
      'Prize amounts in human-readable units. For BTC: [1, 0.5, 0.25]. For USD: [5000, 3500, 2000]',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsNumber({}, { each: true })
  @Min(0.00001, { each: true, message: 'Prize amounts must be at least 0.00001' })
  prizes!: number[];
}
