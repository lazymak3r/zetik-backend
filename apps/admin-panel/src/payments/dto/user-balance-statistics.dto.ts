export interface UserBalanceStatisticsDto {
  userId: string;
  deps: string; // Total deposits in USD
  withs: string; // Total withdrawals in USD
  bets: string; // Total bets in USD
  wins: string; // Total wins in USD
  refunds: string; // Total refunds in USD
}
