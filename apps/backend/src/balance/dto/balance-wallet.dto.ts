import { ApiProperty } from '@nestjs/swagger';
import { AssetTypeEnum } from '@zetik/shared-entities';

export class BalanceWalletDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ enum: AssetTypeEnum, description: 'Asset type' })
  asset!: AssetTypeEnum;

  @ApiProperty({ description: 'Wallet balance' })
  balance!: string;

  @ApiProperty({ description: 'Flag indicating primary wallet' })
  isPrimary!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
