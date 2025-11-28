import { ApiProperty } from '@nestjs/swagger';
import { WithdrawStatusEnum } from '@zetik/shared-entities';

export class WithdrawResponseDto {
  @ApiProperty({ description: 'Request ID' })
  requestId!: string;

  @ApiProperty({ description: 'Withdrawal status', enum: WithdrawStatusEnum })
  status!: WithdrawStatusEnum;

  @ApiProperty({ description: 'Asset being withdrawn' })
  asset!: string;

  @ApiProperty({ description: 'Net amount after network fee deduction' })
  amount!: string;

  @ApiProperty({ description: 'Estimated network fee', required: false })
  estimateNetworkFee?: string;

  @ApiProperty({ description: 'Destination address' })
  toAddress!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;
}
