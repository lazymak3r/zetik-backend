import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum AssetStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

export class UpdateAssetStatusDto {
  @ApiProperty({
    description: 'Asset status',
    enum: AssetStatusEnum,
    example: AssetStatusEnum.ACTIVE,
  })
  @IsEnum(AssetStatusEnum)
  status!: AssetStatusEnum;
}
