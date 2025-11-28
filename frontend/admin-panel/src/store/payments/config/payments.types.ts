export interface Asset {
  symbol: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawRequest {
  id: string;
  userId: string;
  user?: {
    id: string;
    email?: string;
  };
  asset: string;
  amount: string;
  toAddress: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'SENT' | 'FAILED';
  approvedBy?: string;
  approvedAt?: string;
  txId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyRates {
  rates: Record<string, number>;
  lastUpdated: string;
}

export interface UserStatistics {
  userId: string;
  totalDeposits: number;
  totalDepositAmountUsd: number;
  totalWithdrawals: number;
  totalWithdrawalAmountUsd: number;
  pendingWithdrawals: number;
  registrationDate: string;
  lastActivity: string;
}

export interface UserBalanceStatistics {
  userId: string;
  deps: string;
  withs: string;
  bets: string;
  wins: string;
  refunds: string;
}

export interface PaymentsState {
  assets: Asset[];
  withdrawRequests: WithdrawRequest[];
  currencyRates: CurrencyRates | null;
  userStatistics: UserStatistics | null;
  userBalanceStatistics: UserBalanceStatistics | null;
  total: number;
  loading: boolean;
  error: string | null;
}
