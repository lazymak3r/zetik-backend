import { ApiProperty } from '@nestjs/swagger';

export class BetLostSuccessResponseDto {
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
    description: 'Type of operation processed',
    enum: ['lost'],
  })
  operation!: 'lost';

  @ApiProperty({
    description: 'Player balance',
    type: Number,
  })
  balance!: number;
}
