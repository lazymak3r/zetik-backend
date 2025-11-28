export interface IBetConfirmedEventPayload {
  userId: string;
  betAmount: string; // Amount of this specific bet in native asset (e.g., BTC)
  betAmountCents?: string; // Amount in USD cents (for race tracker & VIP wager)
  asset: string; // Asset type of the bet
  operationId: string; // Unique operation ID
  houseEdge?: number; // House edge for this bet (default 0.01 = 1%)
  metadata?: Record<string, unknown>; // Additional context (e.g., sportsbookBet: true)
}
