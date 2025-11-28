import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetTypeEnum, TransactionStatusEnum, TransactionTypeEnum } from '@zetik/shared-entities';

export class TransactionSourceDto {
  @ApiProperty({ description: 'Source ID' })
  id!: string;

  @ApiProperty({ description: 'Source type' })
  type!: string;

  @ApiProperty({ description: 'Source name' })
  name!: string;

  @ApiProperty({ description: 'Source sub-type' })
  subType!: string;
}

export class TransactionDestinationDto {
  @ApiProperty({ description: 'Destination ID' })
  id!: string;

  @ApiProperty({ description: 'Destination type' })
  type!: string;

  @ApiProperty({ description: 'Destination name' })
  name!: string;

  @ApiProperty({ description: 'Destination sub-type' })
  subType!: string;
}

export class AmountInfoDto {
  @ApiProperty({ description: 'Actual amount transferred' })
  amount!: string;

  @ApiProperty({ description: 'Requested amount' })
  requestedAmount!: string;

  @ApiProperty({ description: 'Net amount after fees' })
  netAmount!: string;

  @ApiProperty({ description: 'Amount in USD' })
  amountUSD!: string;
}

export class FeeInfoDto {
  @ApiProperty({ description: 'Network fee' })
  networkFee!: string;
}

export class BlockInfoDto {
  @ApiPropertyOptional({ description: 'Block height' })
  blockHeight?: string;

  @ApiPropertyOptional({ description: 'Block hash' })
  blockHash?: string;
}

export class TransactionResponseDto {
  @ApiProperty({
    description: 'Transaction ID',
    example: 'e5e7e7f4-36ab-4877-a6e3-0f46ac432156',
  })
  id!: string;

  @ApiProperty({
    description: 'Fireblocks asset ID',
    example: 'BTC_TEST',
  })
  assetId!: string;

  @ApiProperty({
    description: 'Internal asset type',
    enum: AssetTypeEnum,
    example: AssetTypeEnum.BTC,
  })
  asset!: AssetTypeEnum;

  @ApiProperty({ type: TransactionSourceDto })
  source!: TransactionSourceDto;

  @ApiProperty({ type: TransactionDestinationDto })
  destination!: TransactionDestinationDto;

  @ApiPropertyOptional({
    description: 'Requested amount',
    example: '0.00000586',
  })
  requestedAmount?: string;

  @ApiPropertyOptional({
    description: 'Actual amount transferred',
    example: '0.00000586',
  })
  amount?: string;

  @ApiPropertyOptional({
    description: 'Net amount after fees',
    example: '0.00000586',
  })
  netAmount?: string;

  @ApiPropertyOptional({
    description: 'Amount in USD',
    example: '0.64667653',
  })
  amountUSD?: string;

  @ApiPropertyOptional({
    description: 'Total fee',
    example: '0.00018005',
  })
  fee?: string;

  @ApiPropertyOptional({
    description: 'Network fee',
    example: '0.00018005',
  })
  networkFee?: string;

  @ApiProperty({
    description: 'Transaction creation timestamp',
    example: 1761804156255,
  })
  createdAt!: number;

  @ApiPropertyOptional({
    description: 'Last updated timestamp',
    example: 1761804431160,
  })
  lastUpdated?: number;

  @ApiProperty({
    description: 'Transaction status',
    example: 'COMPLETED',
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'Transaction sub-status',
    example: 'CONFIRMED',
  })
  subStatus?: string;

  @ApiPropertyOptional({
    description: 'Transaction hash',
    example: '294daac0bc2d04dd5562245359cc32332f0fdcf023a3968f175ec347dbce2a6c',
  })
  txHash?: string;

  @ApiPropertyOptional({
    description: 'Source address',
    example: 'tb1q9wnckupf2j7n8fkl6g2eekqzphs46pf5ajc4ce',
  })
  sourceAddress?: string;

  @ApiPropertyOptional({
    description: 'Destination address',
    example: 'tb1q83p4q6t5wfc8r5sur2ql3lmp5w9388ut3uvpcs',
  })
  destinationAddress?: string;

  @ApiPropertyOptional({
    description: 'Destination address description',
    example: '',
  })
  destinationAddressDescription?: string;

  @ApiPropertyOptional({
    description: 'Destination tag (for XRP, etc.)',
    example: '',
  })
  destinationTag?: string;

  @ApiPropertyOptional({
    description: 'Transaction note (PII sanitized)',
    example: 'Withdrawal for user [REDACTED]',
  })
  note?: string;

  @ApiPropertyOptional({
    description: 'Fee currency',
    example: 'BTC_TEST',
  })
  feeCurrency?: string;

  @ApiPropertyOptional({
    description: 'Operation type',
    example: 'TRANSFER',
  })
  operation?: string;

  @ApiPropertyOptional({
    description: 'Number of confirmations',
    example: 1,
  })
  numOfConfirmations?: number;

  @ApiPropertyOptional({ type: AmountInfoDto })
  amountInfo?: AmountInfoDto;

  @ApiPropertyOptional({ type: FeeInfoDto })
  feeInfo?: FeeInfoDto;

  @ApiPropertyOptional({ type: BlockInfoDto })
  blockInfo?: BlockInfoDto;

  @ApiPropertyOptional({
    description: 'Asset type',
    example: 'BASE_ASSET',
  })
  assetType?: string;

  @ApiPropertyOptional({
    description: 'Customer reference ID (for withdrawals)',
    example: '48f58c17-a135-44c9-9069-fdbe5c8a2fc8',
  })
  customerRefId?: string;

  @ApiPropertyOptional({
    description: 'Transaction index (for deposits)',
    example: 0,
  })
  index?: number;
}

export class UserTransactionItemDto {
  @ApiProperty({ description: 'Transaction ID' })
  id!: string;

  @ApiProperty({ enum: TransactionTypeEnum, description: 'Transaction type' })
  type!: TransactionTypeEnum;

  @ApiProperty({ enum: TransactionStatusEnum, description: 'Transaction status' })
  status!: TransactionStatusEnum;

  @ApiProperty({ description: 'Transaction amount' })
  amount!: string;

  @ApiProperty({ enum: AssetTypeEnum, description: 'Asset type' })
  asset!: AssetTypeEnum;

  @ApiProperty({ description: 'Transaction address', nullable: true })
  address?: string;

  @ApiProperty({ description: 'Transaction hash', nullable: true })
  txHash?: string;

  @ApiProperty({ description: 'Amount in USD', nullable: true })
  amountUSD?: string;

  @ApiProperty({ description: 'Network fee', nullable: true })
  networkFee?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Update timestamp' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Fireblocks creation timestamp', nullable: true })
  fbCreatedAt?: Date;

  @ApiProperty({ description: 'Credit timestamp', nullable: true })
  creditedAt?: Date;

  @ApiProperty({ description: 'Whether transaction is credited' })
  isCredited!: boolean;
}

export class UserTransactionsResponseDto {
  @ApiProperty({ type: [UserTransactionItemDto], description: 'List of transactions' })
  transactions!: UserTransactionItemDto[];

  @ApiProperty({ description: 'Total count of transactions' })
  total!: number;

  @ApiProperty({ description: 'Current page' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages!: number;
}

export class GetUserTransactionsQueryDto {
  @ApiProperty({ required: false, default: 1, description: 'Page number' })
  page?: number = 1;

  @ApiProperty({ required: false, default: 20, description: 'Items per page' })
  limit?: number = 20;

  @ApiProperty({
    required: false,
    enum: TransactionTypeEnum,
    description: 'Filter by transaction type',
  })
  type?: TransactionTypeEnum;

  @ApiProperty({ required: false, enum: AssetTypeEnum, description: 'Filter by asset' })
  asset?: AssetTypeEnum;

  @ApiProperty({
    required: false,
    enum: TransactionStatusEnum,
    description: 'Filter by transaction status',
  })
  status?: TransactionStatusEnum;

  @ApiProperty({
    required: false,
    enum: ['createdAt', 'amount'],
    enumName: 'OrderByField',
    description: 'Field to order by',
    default: 'createdAt',
  })
  orderBy?: 'createdAt' | 'amount' = 'createdAt';

  @ApiProperty({
    required: false,
    enum: ['ASC', 'DESC'],
    enumName: 'OrderDirection',
    description: 'Order direction',
    default: 'DESC',
  })
  orderDirection?: 'ASC' | 'DESC' = 'DESC';
}
