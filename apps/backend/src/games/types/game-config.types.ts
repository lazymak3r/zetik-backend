import { ApiProperty } from '@nestjs/swagger';
import { GameStatus, GameType } from '../entities/game-config.entity';

/**
 * Response DTO for game configuration
 */
export class GameConfigResponse {
  @ApiProperty({ description: 'Unique identifier for the game configuration' })
  id!: string;

  @ApiProperty({ enum: GameType, description: 'Type of the game' })
  gameType!: GameType;

  @ApiProperty({ enum: GameStatus, description: 'Status of the game' })
  status!: GameStatus;

  @ApiProperty({ description: 'Display name of the game' })
  name!: string;

  @ApiProperty({ description: 'Description of the game configuration', required: false })
  description?: string;

  @ApiProperty({ description: 'User who created this configuration', required: false })
  createdBy?: string;

  @ApiProperty({ description: 'User who last updated this configuration', required: false })
  updatedBy?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

/**
 * Response DTO for simplified bet limits (USD only)
 */
export class BetLimitsResponse {
  @ApiProperty({ enum: GameType, description: 'Type of the game' })
  gameType!: GameType;

  @ApiProperty({ description: 'Minimum bet amount in USD' })
  minBetUsd!: number;

  @ApiProperty({ description: 'Maximum bet amount in USD' })
  maxBetUsd!: number;

  @ApiProperty({ description: 'Maximum payout amount in USD - auto cashout when exceeded' })
  maxPayoutUsd!: number;

  @ApiProperty({ description: 'Whether these limits are currently active' })
  isActive!: boolean;
}

/**
 * Bet validation response interface
 */
export interface BetValidationResponse {
  isValid: boolean;
  error?: string;
  usdAmount?: number;
}

/**
 * Interface for simplified bet limits (used in service layer)
 */
export interface BetLimits {
  gameType: GameType;
  minBetUsd: number;
  maxBetUsd: number;
  maxPayoutUsd: number;
  isActive: boolean;
}
