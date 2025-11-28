import { AssetTypeEnum } from '@zetik/shared-entities';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class AdminCreditInput {
  @IsUUID(4)
  userId!: string;

  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  // Decimal string up to 8 dp, positive only
  @IsString()
  @Matches(/^\d+(?:\.\d{1,8})?$/)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class AdminCreditResponseDto {
  operationId!: string;
  userId!: string;
  asset!: AssetTypeEnum;
  amount!: string;
  balance!: string;
}
