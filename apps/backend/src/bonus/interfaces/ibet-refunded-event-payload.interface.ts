export interface IBetRefundedEventPayload {
  userId: string;
  refundAmount: string; // Refund amount in native asset (e.g., BTC)
  refundAmountCents?: string; // Refund amount in USD cents
  asset: string; // Asset type of the refund
  operationId: string; // Unique operation ID
  description?: string; // Refund description
  metadata?: Record<string, unknown>; // Additional context
}
