import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetSpecificAddressValidator, AssetTypeEnum } from '@zetik/shared-entities';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Validate,
} from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

// Helper function to get example address based on environment
function getExampleAddress(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction
    ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
    : 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
}

export class CreateWithdrawRequestDto {
  // Client requestId is no longer in use. It's created at server-side by randomUUID instead
  // Keep it here for legacy code compatibility
  @ApiProperty({
    description: 'Unique request ID for idempotency',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  requestId!: string;

  @ApiProperty({
    description: 'Asset to withdraw',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  @IsEnum(AssetTypeEnum, { message: ERROR_MESSAGES.VALIDATION.INVALID_ASSET })
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  asset!: AssetTypeEnum;

  @ApiProperty({
    description: 'Amount to withdraw in asset units',
    example: '0.001',
    pattern: '^\\d+(\\.\\d{1,8})?$',
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT,
  })
  @Transform(({ value }: { value: unknown }): string => {
    // Normalize decimal representation
    if (typeof value === 'string') {
      const num = parseFloat(value);
      if (isNaN(num) || num <= 0) {
        return value; // Let validation handle the error
      }
      // Ensure maximum 8 decimal places
      return num.toFixed(8).replace(/\.?0+$/, '');
    }
    return value as string;
  })
  amount!: string;

  @ApiProperty({
    description: 'Destination cryptocurrency address',
    example: getExampleAddress(),
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  // use package "multicoin-address-validator" to validate the asset address of cryptocoins
  @Validate(AssetSpecificAddressValidator)
  toAddress!: string;

  /**
   * NETWORK FEE HANDLING STRATEGY:
   *
   * The estimateNetworkFee is used to deduct from user's balance upfront when creating
   * the withdrawal request. The actual network fee charged by Fireblocks may differ
   * from this estimate.
   *
   * Why no validation is performed:
   * - User balance is already updated with the estimated fee at request creation
   * - Actual network fee is determined during Fireblocks transaction processing
   * - Webhook events return the final charged fee which may differ from estimate
   * - We accept the variance (profit/loss) between estimated and actual fees
   * - Re-charging users post-withdrawal is not feasible or user-friendly
   *
   * Risk Management:
   * - Merchant absorbs the difference if actual fee exceeds estimate
   * - Over-estimates result in merchant keeping the excess
   * - This simplifies user experience and avoids complex reconciliation
   */
  @ApiProperty({
    description: 'Optional: Pre-calculated network fee estimate (for idempotency)',
    example: '0.00015',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,18})?$/, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT,
  })
  estimateNetworkFee?: string;
  @ApiPropertyOptional({
    description: '6-digit 2FA code (REQUIRED - withdrawals always need 2FA)',
    example: '123456',
  })
  @IsOptional()
  @IsNumberString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  twoFactorCode?: string;
}
