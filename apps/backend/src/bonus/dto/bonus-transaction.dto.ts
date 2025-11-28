import { ApiProperty } from '@nestjs/swagger';
import { BonusTransactionStatusEnum, BonusTypeEnum } from '@zetik/shared-entities';

export class BonusTransactionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: BonusTypeEnum })
  bonusType!: BonusTypeEnum;

  @ApiProperty({ description: 'Bonus amount in dollars (USD)' })
  amount!: string;

  @ApiProperty({ enum: BonusTransactionStatusEnum })
  status!: BonusTransactionStatusEnum;

  @ApiProperty({ required: false })
  claimedAt?: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  updatedBy?: string;

  @ApiProperty({ required: false })
  metadata?: Record<string, any>;
}
