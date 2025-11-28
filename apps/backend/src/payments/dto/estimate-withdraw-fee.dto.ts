import { AssetSpecificAddressValidator, AssetTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsNotEmpty, IsString, Matches, Validate } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class EstimateWithdrawFeeDto {
  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  @IsString()
  @IsNotEmpty()
  @Validate(AssetSpecificAddressValidator)
  toAddress!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT,
  })
  amount!: string;
}
