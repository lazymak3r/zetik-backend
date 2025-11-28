import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, ValidateNested } from 'class-validator';
import { SelectionItemDto, TransactionItemDto } from './common.dto';

export class BetLostRequestDto {
  @ApiProperty({
    description: 'Unique identifier assigned by Partner',
  })
  @IsString()
  bet_transaction_id!: string;

  @ApiProperty({
    description: 'Amount of money to be transferred to players balance expressed in cents',
    type: Number,
  })
  @IsNumber()
  amount!: number;

  @ApiProperty({
    description:
      'Currency code. The full list of currencies supported can be found in the Appendices',
  })
  @IsString()
  currency!: string;

  @ApiProperty({
    description: 'Dictionary containing description of transaction',
    type: TransactionItemDto,
  })
  @ValidateNested()
  @Type(() => TransactionItemDto)
  transaction!: TransactionItemDto;

  @ApiProperty({
    description: 'Provides statuses of all selections included (open, lost, won, etc)',
    type: () => [SelectionItemDto],
  })
  @ValidateNested({ each: true })
  @Type(() => SelectionItemDto)
  selections!: SelectionItemDto[];
}
