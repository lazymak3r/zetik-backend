import { ApiProperty } from '@nestjs/swagger';
import { LimitPeriodEnum, PlatformTypeEnum, SelfExclusionTypeEnum } from '@zetik/shared-entities';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isEndDateRequiredForTemporary', async: false })
export class IsEndDateRequiredForTemporaryConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    if (object.type === SelfExclusionTypeEnum.TEMPORARY) {
      return value !== undefined && value !== null;
    }
    return true;
  }

  defaultMessage() {
    return 'End date is required for temporary exclusion';
  }
}

export function IsEndDateRequiredForTemporary(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEndDateRequiredForTemporaryConstraint,
    });
  };
}

export class CreateSelfExclusionDto {
  @ApiProperty({
    description: 'Self-exclusion type',
    enum: SelfExclusionTypeEnum,
    example: SelfExclusionTypeEnum.TEMPORARY,
  })
  @IsNotEmpty()
  @IsEnum(SelfExclusionTypeEnum)
  type!: SelfExclusionTypeEnum;

  @ApiProperty({
    description: 'Platform type for the exclusion (sports, casino, or platform)',
    enum: PlatformTypeEnum,
    example: PlatformTypeEnum.PLATFORM,
    required: false,
    default: PlatformTypeEnum.PLATFORM,
  })
  @IsOptional()
  @IsEnum(PlatformTypeEnum)
  platformType?: PlatformTypeEnum;

  @ApiProperty({
    description: 'Period for limits (daily, weekly, monthly, session)',
    enum: LimitPeriodEnum,
    example: LimitPeriodEnum.DAILY,
    required: false,
  })
  @IsOptional()
  @IsEnum(LimitPeriodEnum)
  @ValidateIf(
    (o) =>
      o.type === SelfExclusionTypeEnum.DEPOSIT_LIMIT || o.type === SelfExclusionTypeEnum.LOSS_LIMIT,
  )
  @IsNotEmpty({ message: 'Period is required for deposit and loss limits' })
  period?: LimitPeriodEnum;

  @ApiProperty({
    description:
      'Limit amount (for deposit and loss limits). Set to 0 or null to remove an existing limit.',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Limit amount must be 0 or greater' })
  @ValidateIf(
    (o) =>
      o.type === SelfExclusionTypeEnum.DEPOSIT_LIMIT || o.type === SelfExclusionTypeEnum.LOSS_LIMIT,
  )
  @IsNotEmpty({ message: 'Limit amount is required for deposit and loss limits' })
  limitAmount?: number | null;

  @ApiProperty({
    description: 'End date of the exclusion (not required for permanent exclusion)',
    example: '2025-06-12T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @IsEndDateRequiredForTemporary()
  endDate?: Date;
}
