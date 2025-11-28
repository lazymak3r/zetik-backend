import { ApiProperty } from '@nestjs/swagger';
import { BonusTransactionDto } from './bonus-transaction.dto';

export class GetBonusTransactionsResponseDto {
  @ApiProperty({ type: [BonusTransactionDto] })
  data!: BonusTransactionDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;
}
