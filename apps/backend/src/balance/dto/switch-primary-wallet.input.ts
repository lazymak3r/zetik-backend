import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { IsEnum } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class SwitchPrimaryWalletInput {
  @ApiProperty({ enum: AssetTypeEnum, description: 'Asset to set as primary wallet' })
  @IsEnum(AssetTypeEnum, { message: ERROR_MESSAGES.VALIDATION.INVALID_ASSET })
  asset!: AssetTypeEnum;
}
