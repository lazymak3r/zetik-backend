import { ApiProperty } from '@nestjs/swagger';
import { BonusTransactionStatusEnum } from '@zetik/shared-entities';

export class WeeklyReloadBonusDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Amount in dollars (e.g., "357.14")' })
  amount!: string;

  @ApiProperty({ enum: BonusTransactionStatusEnum })
  status!: BonusTransactionStatusEnum;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  activateAt?: Date;

  @ApiProperty({ required: false })
  expiredAt?: Date;

  @ApiProperty({ required: false })
  claimedAt?: Date;

  @ApiProperty({ required: false })
  metadata?: any;
}
