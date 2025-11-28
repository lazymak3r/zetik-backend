import { ApiProperty } from '@nestjs/swagger';

export class EstimateWithdrawFeeResponseDto {
  @ApiProperty({ description: 'Asset being withdrawn' })
  asset!: string;

  @ApiProperty({ description: 'Original withdrawal amount' })
  originalAmount!: string;

  @ApiProperty({ description: 'Estimated network fee' })
  networkFee!: string;

  @ApiProperty({ description: 'Net amount after fee deduction' })
  netAmount!: string;
}
