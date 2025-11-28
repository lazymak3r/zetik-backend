export interface IBalanceReportRequest {
  userIds: string[];
  fromDate: Date;
  toDate: Date;
}

export interface IUserBalanceReport {
  userId: string;
  totalWager: string;
  totalWins: string;
  netWager: string;
  totalDeposits: string;
  totalWithdrawals: string;
  transactionCount: number;
  currentVipLevel?: number;
}

export interface IBalanceReportResponse {
  users: IUserBalanceReport[];
  fromDate: Date;
  toDate: Date;
  totalUsers: number;
  generatedAt: Date;
}
