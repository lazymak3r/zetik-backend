export interface TransactionDto {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  amount: string;
  asset: string;
  amountUSD: string;
  status: string;
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface TransactionSummaryDto {
  totalDeposits: string;
  totalWithdrawals: string;
  pendingCount: number;
  pendingValue: string;
}

export interface TransactionsResponseDto {
  items: TransactionDto[];
  total: number;
  page: number;
  pages: number;
  summary: TransactionSummaryDto;
}

export interface WithdrawRequestDto {
  id: string;
  userId: string;
  userEmail: string;
  asset: string;
  amount: string;
  amountUSD: string;
  toAddress: string;
  status: string;
  createdAt: Date;
  processedAt?: Date;
  processedBy?: string;
  txHash?: string;
  rejectReason?: string;
  userDetails: {
    totalDeposits: string;
    totalWithdrawals: string;
    currentBalance: string;
    accountAge: number;
    isVerified: boolean;
  };
}
