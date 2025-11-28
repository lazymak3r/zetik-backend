import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBigNumber } from '@zetik/common';
import { AssetTypeEnum } from '@zetik/shared-entities';
import { BigNumber } from 'bignumber.js';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';
import { IVaultInfo, IVaultTransferResult } from '../interfaces/vault.interface';

export class VaultTransferInput {
  @ApiProperty({
    description: 'Idempotency key (UUID v4)',
    format: 'uuid',
    example: '8cf45f34-cd4d-4a95-9b3a-7c8e3a8f8f77',
  })
  @IsString()
  @IsUUID(4, { message: ERROR_MESSAGES.VALIDATION.INVALID_UUID })
  operationId!: string;

  @ApiProperty({ enum: AssetTypeEnum, description: 'Asset type', example: AssetTypeEnum.BTC })
  @IsEnum(AssetTypeEnum, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_ASSET,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({
    type: String,
    description: 'Amount in asset units as string (max 8 dp)',
    example: '0.00005',
  })
  @IsBigNumber({ message: ERROR_MESSAGES.VALIDATION.INVALID_AMOUNT_FORMAT })
  @Transform(({ value }: { value: unknown }): BigNumber => {
    const bn = new BigNumber(value as string | number);
    if (bn.isLessThanOrEqualTo(0)) {
      throw new Error(ERROR_MESSAGES.VALIDATION.AMOUNT_TOO_SMALL);
    }
    return bn.decimalPlaces(8);
  })
  amount!: BigNumber;

  @ApiPropertyOptional({ type: Object, additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '6-digit 2FA code (REQUIRED for vault withdrawals - always need 2FA)',
    example: '123456',
  })
  @IsOptional()
  @IsNumberString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  twoFactorCode?: string;
}

export class VaultDto implements IVaultInfo {
  @ApiProperty({ enum: AssetTypeEnum, example: AssetTypeEnum.BTC })
  asset!: AssetTypeEnum;
  @ApiProperty({ type: String, example: '1.23456789' })
  balance!: string;
  @ApiProperty({ type: String, example: '2025-01-01T00:00:00.000Z' })
  createdAt!: Date;
  @ApiProperty({ type: String, example: '2025-01-02T00:00:00.000Z' })
  updatedAt!: Date;
}

export class VaultTransferResultDto implements IVaultTransferResult {
  @ApiProperty({ enum: AssetTypeEnum, example: AssetTypeEnum.BTC })
  asset!: AssetTypeEnum;
  @ApiProperty({
    type: String,
    description: 'New wallet balance after operation',
    example: '10.34142168',
  })
  walletBalance!: string;
  @ApiProperty({
    type: String,
    description: 'New vault balance after operation',
    example: '0.00005',
  })
  vaultBalance!: string;
}
