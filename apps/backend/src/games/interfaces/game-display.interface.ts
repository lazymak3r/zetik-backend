import { CurrencyEnum } from '@zetik/common';

/**
 * Standardized interface for fiat preservation fields
 * All game response DTOs should implement this to preserve original fiat currency data
 */
export interface GameDisplayFields {
  // Original preservation fields
  originalFiatAmount?: string;
  originalFiatCurrency?: CurrencyEnum;
  fiatToUsdRate?: string;
}

/**
 * Base interface for all game responses that include fiat preservation data
 */
export interface BaseGameResponse extends GameDisplayFields {
  // Game-specific fields can be added by extending this interface
  [key: string]: any;
}

/**
 * Interface for bet placement responses
 */
export interface BetPlacementResponse extends BaseGameResponse {
  // Common bet fields
  id: string;
  userId: string;
  betAmount: string;
  asset: string;
  createdAt: Date;
}

/**
 * Interface for completed game responses
 */
export interface CompletedGameResponse extends BaseGameResponse {
  // Common completed game fields
  id: string;
  userId: string;
  betAmount: string;
  asset: string;
  payout: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
