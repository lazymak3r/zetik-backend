import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MakeBetSuccessResponseDto {
  @ApiProperty({
    description: 'Unique identifier for transaction assigned by Partner',
  })
  id!: string;

  @ApiProperty({
    description: 'Unique identifier of transaction assigned by Betby',
  })
  ext_transaction_id!: string;

  @ApiPropertyOptional({
    description:
      'Unique identifier of parent transaction assigned by Partner. Doesn\'t exist for "bet" transaction.',
  })
  parent_transaction_id?: string | null;

  @ApiProperty({
    description: 'Unique identifier of the player assigned by Partner',
  })
  user_id!: string;

  @ApiProperty({
    description: 'Kind of transaction',
    enum: ['bet', 'win', 'refund', 'lost', 'rollback'],
  })
  operation!: 'bet' | 'win' | 'refund' | 'lost' | 'rollback';

  @ApiProperty({
    description:
      'The amount of money of a given currency to be placed by player expressed in cents',
    type: Number,
  })
  amount!: number;

  @ApiProperty({
    description:
      'Currency code. The full list of currencies supported can be found in the Appendices',
  })
  currency!: string;

  @ApiProperty({
    description: 'Balance of player after transaction is applied',
    type: Number,
  })
  balance!: number;

  @ApiPropertyOptional({
    description:
      'Optional. Is used only in case bonus money is used to place a bet. Amount of bonus money in stake. It is strictly recommended not allowing more than 50% of bonus money in stake to prevent abuse. Contact your AM for more information.',
    type: Number,
  })
  operator_bonus_amount?: number;
}
