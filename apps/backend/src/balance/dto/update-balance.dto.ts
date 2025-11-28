import { CurrencyEnum, IsBigNumber } from '@zetik/common';
import { AssetTypeEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class UpdateFiatBalanceDto {
  @IsEnum(BalanceOperationEnum, {
    message: ERROR_MESSAGES.FINANCIAL.INVALID_OPERATION,
  })
  operation!: BalanceOperationEnum;

  @IsString()
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  operationId!: string;

  @IsString({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  userId!: string;

  @IsEnum(CurrencyEnum)
  currency!: CurrencyEnum;

  @IsString()
  amount!: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim().slice(0, 255) : (value as string | undefined),
  )
  description?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  houseEdge?: number;
}

export class UpdateBalanceDto {
  @IsEnum(BalanceOperationEnum, {
    message: ERROR_MESSAGES.FINANCIAL.INVALID_OPERATION,
  })
  operation!: BalanceOperationEnum;

  @IsString()
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  operationId!: string;

  @IsString({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  userId!: string;

  @IsBigNumber({ message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @Transform(({ value }: { value: unknown }): BigNumber => {
    try {
      // Try to convert the value to BigNumber
      const bn = new BigNumber(value as string | number);

      // Check for non-negative value (allow 0 for demo mode)
      if (bn.isLessThan(0)) {
        throw new Error(ERROR_MESSAGES.VALIDATION.AMOUNT_TOO_SMALL);
      }

      // Check for maximum value
      if (bn.isGreaterThan(999999999)) {
        throw new Error(ERROR_MESSAGES.VALIDATION.AMOUNT_TOO_LARGE);
      }

      // Limit to 8 decimal places
      return bn.decimalPlaces(8);
    } catch {
      // In case of conversion error, return the original value;
      // the IsBigNumber validator will detect the error
      return value as any;
    }
  })
  amount!: BigNumber;

  @IsEnum(AssetTypeEnum, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_ASSET,
  })
  asset!: AssetTypeEnum;

  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: unknown }): string | undefined =>
    typeof value === 'string' ? value.trim().slice(0, 255) : (value as string | undefined),
  )
  description?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  houseEdge?: number;
}
