export interface User {
  id: string;
  email: string;
  username?: string;
  isBanned: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  totalDeposits: string;
  totalWithdrawals: string;
  currentBalance: string;
  mutedUntil?: Date | null;
  muteReason?: string | null;
  isUserMuted?: boolean;
}

export interface UserDetails extends User {
  updatedAt: Date;
  cookieConsentAcceptedAt?: Date | null;
  financials: {
    totalDeposits: string;
    totalWithdrawals: string;
    totalBets: string;
    totalWins: string;
    currentBalance: string;
    netProfit: string;
  };
  wallets: Array<{
    asset: string;
    balance: string;
    address: string;
  }>;
  gameStats: {
    totalGames: number;
    favoriteGame: string;
    winRate: number;
    averageBetSize: string;
  };
}

export interface UserTransaction {
  id: string;
  type: string;
  amount: string;
  asset: string;
  status: string;
  createdAt: Date;
  metadata?: string;
}

export interface UsersState {
  users: User[];
  selectedUser: UserDetails | null;
  total: number;
  page: number;
  pages: number;
  loading: boolean;
  error: string | null;
  userTransactions: UserTransaction[];
  userTransactionsTotal: number;
  userTransactionsPage: number;
  userTransactionsLoading: boolean;
  userTransactionsError: string | null;
}
