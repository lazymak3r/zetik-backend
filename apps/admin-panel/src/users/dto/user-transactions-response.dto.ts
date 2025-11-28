import { ApiProperty } from '@nestjs/swagger';

export class UserTransactionItemDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Transaction type',
    example: 'DEPOSIT',
  })
  type!: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: '100.50',
  })
  amount!: string;

  @ApiProperty({
    description: 'Asset symbol',
    example: 'USDT',
  })
  asset!: string;

  @ApiProperty({
    description: 'Transaction metadata',
    example: '{"txHash": "0x123..."}',
  })
  metadata!: string;

  @ApiProperty({
    description: 'Transaction status',
    example: 'COMPLETED',
  })
  status!: string;

  @ApiProperty({
    description: 'Transaction creation date',
    example: '2025-05-12T12:00:00Z',
    format: 'date-time',
  })
  createdAt!: string;
}

export class UserTransactionsResponseDto {
  @ApiProperty({
    description: 'List of transactions',
    type: [UserTransactionItemDto],
  })
  items!: UserTransactionItemDto[];

  @ApiProperty({
    description: 'Total number of transactions',
    example: 150,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 15,
  })
  pages!: number;
}
