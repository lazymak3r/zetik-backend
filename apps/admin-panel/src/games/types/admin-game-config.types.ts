import { GameStatus, GameType } from '@zetik/shared-entities';

/**
 * Admin panel specific interface that combines game config with bet limits
 */
export interface GameConfig {
  gameType: GameType;
  status: GameStatus;
  name: string;
  description?: string;
  minBetUsd: number;
  maxBetUsd: number;
  maxPayoutUsd: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for updating bet limits in admin panel
 */
export interface BetLimitsUpdate {
  gameType: GameType;
  minBetUsd: number;
  maxBetUsd: number;
  maxPayoutUsd: number;
}
