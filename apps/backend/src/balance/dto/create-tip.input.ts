import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBigNumber } from '@zetik/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumberString, IsOptional, IsString, Length } from 'class-validator';

export class CreateTipInput {
  @ApiProperty({ description: 'Recipient username or email', example: 'john_doe' })
  @IsString()
  @Length(3, 320)
  toUsername!: string;

  @ApiProperty({
    description: 'Tip amount as string (up to 8 decimals)',
    example: '0.00000100',
    type: String,
  })
  @IsBigNumber()
  @Transform(({ value }: { value: unknown }): BigNumber => {
    const bn = new BigNumber(value as string | number);
    if (bn.isLessThanOrEqualTo(0)) {
      // Mimic UpdateBalanceDto behavior to fail validation on non-positive values
      throw new Error('Amount must be greater than 0');
    }
    if (bn.isGreaterThan(999999999)) {
      throw new Error('Amount is too large');
    }
    return bn.abs().decimalPlaces(8);
  })
  amount!: BigNumber;

  @ApiProperty({ description: 'Asset to tip', enum: AssetTypeEnum, example: 'BTC' })
  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  @ApiPropertyOptional({
    description: '6-digit 2FA code (required if 2FA is enabled for the user)',
    example: '123456',
  })
  @IsOptional()
  @IsNumberString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  twoFactorCode?: string;

  @ApiPropertyOptional({
    description: 'If true, may broadcast to global chat (TODO)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  publicTip?: boolean; // TODO: emit global chat message if true

  @ApiPropertyOptional({
    description: 'Optional message (1-280 chars)',
    example: 'gg wp',
    minLength: 1,
    maxLength: 280,
  })
  @IsString()
  @IsOptional()
  @Length(1, 280)
  message?: string;
}

export class TipResultDto {
  @ApiProperty({
    description: 'Sender operation id (TIP_SEND)',
    example: 'e844c5ca-728c-49b6-9896-81ab7712e1ba',
  })
  sendOperationId!: string;

  @ApiProperty({
    description: 'Receiver operation id (TIP_RECEIVE)',
    example: 'b7bde792-29cd-4338-91fa-25a4b6337429',
  })
  receiveOperationId!: string;

  @ApiProperty({
    description: 'Sender balance after tip (asset balance as string)',
    example: '11.72469515',
  })
  senderBalance!: string;

  @ApiProperty({
    description: 'Receiver balance after tip (asset balance as string)',
    example: '0.00000200',
  })
  receiverBalance!: string;
}
