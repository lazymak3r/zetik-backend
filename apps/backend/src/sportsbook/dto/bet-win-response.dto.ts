import { ApiProperty } from '@nestjs/swagger';

export class BetWinSuccessResponseDto {
  @ApiProperty({
    description: 'Unique identifier assigned by Partner to a given transaction',
  })
  id!: string;

  @ApiProperty({
    description: 'Unique identifier assigned by Betby to a given transaction',
  })
  ext_transaction_id!: string;

  @ApiProperty({
    description: 'Unique identifier of parent transaction assigned by Partner',
  })
  parent_transaction_id!: string;

  @ApiProperty({
    description: 'Unique identifier of player assigned by Partner',
  })
  user_id!: string;

  @ApiProperty({
    description: 'Type of operation to be performed',
    enum: ['win'],
  })
  operation!: 'win';

  @ApiProperty({
    description: 'The sum of money to be transferred expressed in cents',
    type: Number,
  })
  amount!: number;

  @ApiProperty({
    description: 'Currency code',
  })
  currency!: string;

  @ApiProperty({
    description: 'Player balance',
    type: Number,
  })
  balance!: number;
}
