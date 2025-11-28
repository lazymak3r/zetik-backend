import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

// Base DTOs
export class SimulateBetDto {
  @IsUUID()
  userId!: string;

  @IsString()
  amount!: string; // Amount in cents

  @IsOptional()
  @IsString()
  operationId?: string;
}

export interface SimulateBetResponseDto {
  success: boolean;
  message: string;
  newBalance: string;
  vipLevelChanged: boolean;
  newVipLevel: number;
}

export class SimulateWinDto {
  @IsUUID()
  userId!: string;

  @IsString()
  amount!: string; // Amount in cents

  @IsOptional()
  @IsString()
  operationId?: string;
}

export interface SimulateWinResponseDto {
  success: boolean;
  message: string;
  newBalance: string;
  winAmount: string;
}

// Game session simulation
export class GameDto {
  @IsString()
  betAmount!: string; // Amount in cents

  @IsOptional()
  @IsString()
  winAmount?: string; // Amount in cents
}

export class SimulateGameSessionDto {
  @IsUUID()
  userId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameDto)
  games!: GameDto[];
}

export interface GameResultDto {
  betAmount: string;
  winAmount: string;
  netResult: number; // Positive = win, negative = loss
}

export interface SimulateGameSessionResponseDto {
  success: boolean;
  message: string;
  games: GameResultDto[];
  totalBet: string;
  totalWin: string;
}

// Bonus trigger DTOs
export interface TriggerBonusDto {
  // Empty for now, might add filters later
  // Placeholder to avoid empty interface warning - can be removed when filters are added
  _placeholder?: never;
}

export interface TriggerBonusResponseDto {
  success: boolean;
  message: string;
}

// User stats reset
export class ResetUserStatsDto {
  @IsUUID()
  userId!: string;
}

export interface ResetUserStatsResponseDto {
  success: boolean;
  message: string;
  details?: {
    vipLevel: number;
    vipWager: string;
    historyRecordsDeleted: number;
    bonusTransactionsDeleted: number;
    balanceStats: {
      bets: string;
      wins: string;
      refunds: string;
      deps: string;
      withs: string;
    };
  };
}
