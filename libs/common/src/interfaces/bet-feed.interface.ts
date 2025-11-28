import { GameTypeEnum } from '../enums/game-type.enum';
/**
 * Bet Feed Types
 *
 * Shared interfaces for bet feed functionality across main backend and bet-feed-service.
 * These types ensure consistency between the REST API (main backend) and
 * WebSocket events (bet-feed-service).
 */

/**
 * Individual bet item in the feed
 */
export interface IBetFeedItem {
  /** Bet ID (used as unique identifier) */
  id: string;

  /** Game information */
  game: {
    name: string;
    iconName?: string;
    imageName?: string;
    /**
     * Type of game for frontend routing
     * Should be a value from GameTypeEnum (@zetik/shared-entities)
     * e.g., 'CRASH', 'DICE', 'PROVIDER', 'SPORTSBOOK'
     */
    gameType: GameTypeEnum;
    /** Game code for provider games (e.g., "sugar-rush" from "pragmaticplay:sugar-rush") */
    gameCode?: string;
  };

  /** User information (null for private users) */
  user: {
    id: string;
    name: string;
    imageName?: string; // VIP level image
  } | null;

  /** Bet creation timestamp (ISO string) */
  time: string;

  /** Bet amount in crypto */
  bet: string;

  /** Multiplier applied to bet */
  multiplier: string;

  /** Payout amount in crypto */
  payout: string;

  /** Cryptocurrency asset (e.g., BTC, ETH, USDT) */
  cryptoAsset: string;

  /** Asset image path */
  assetImagePath: string;
}

/**
 * Bet feed tab types
 */
export enum BetFeedTab {
  ALL_BETS = 'all-bets',
  LUCKY_WINNERS = 'lucky-winners',
  ZETIKS = 'Zetiks',
}

/**
 * Response format for bet feed REST API
 */
export interface IBetFeedResponse {
  /** Array of bet feed items */
  bets: IBetFeedItem[];

  /** Last update timestamp (ISO string) */
  lastUpdate: string;

  /** Tab type for this feed */
  tab: BetFeedTab;

  /** Total count of bets returned */
  totalCount: number;
}

/**
 * Delta update for WebSocket events (future optimization)
 */
export interface IBetFeedDelta {
  /** Tab this delta applies to */
  tab: BetFeedTab;

  /** New bets to add to feed */
  newBets: IBetFeedItem[];

  /** Count of new bets */
  count: number;

  /** Timestamp of delta update */
  timestamp: string;
}

/**
 * Top winner item (extends bet feed item with placement)
 */
export interface ITopWinnerItem extends IBetFeedItem {
  /** Winner placement (1, 2, 3) */
  place: number;
}
