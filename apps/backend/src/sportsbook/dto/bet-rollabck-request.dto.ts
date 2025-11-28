import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import { TransactionItemDto } from './common.dto';

export class BetRollbackRequestDto {
  @ApiProperty({
    description: 'Transaction identifier assigned by Partner, received by /bet_make call',
  })
  @IsString()
  bet_transaction_id!: string;

  @ApiProperty({
    description: 'Previous transaction identifier assigned by Partner',
  })
  @IsString()
  parent_transaction_id!: string;

  @ApiProperty({
    description: 'Dictionary containing information about the transaction',
    type: TransactionItemDto,
  })
  @ValidateNested()
  @Type(() => TransactionItemDto)
  transaction!: TransactionItemDto;
}
