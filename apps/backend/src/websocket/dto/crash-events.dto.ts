import { AssetTypeEnum, CrashBetStatusEnum, CrashGameStatusEnum } from '@zetik/shared-entities';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CrashGameStateDto {
  @IsString()
  id!: string;

  @IsEnum(CrashGameStatusEnum)
  status!: CrashGameStatusEnum;

  @IsOptional()
  @IsString()
  crashPoint?: string;

  @IsOptional()
  @IsString()
  currentMultiplier?: string;

  @IsOptional()
  @IsNumber()
  timeRemaining?: number;

  @IsNumber()
  betsCount!: number;

  @IsString()
  totalBetAmount!: string;

  @IsString()
  serverSeedHash!: string;

  @IsNumber()
  gameIndex!: number;
}

export class CrashMultiplierUpdateDto {
  @IsString()
  gameId!: string;

  @IsString()
  multiplier!: string;

  @IsNumber()
  timestamp!: number;
}

export class CrashBetPlacedDto {
  @IsString()
  gameId!: string;

  @IsString()
  userId!: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  vipImageUrl?: string;

  @IsEnum(AssetTypeEnum)
  asset!: AssetTypeEnum;

  @IsString()
  betAmount!: string;

  @IsOptional()
  @IsString()
  autoCashOutAt?: string;
}

export class CrashCashOutDto {
  @IsString()
  gameId!: string;

  @IsString()
  userId!: string;

  @IsString()
  betId!: string;

  @IsString()
  multiplier!: string;

  @IsString()
  winAmount!: string;
}

export class CrashGameCrashedDto {
  // Match REST history item shape
  @IsString()
  id!: string; // game id

  @IsEnum(CrashGameStatusEnum)
  status!: CrashGameStatusEnum; // should be CRASHED at emit time

  @IsString()
  crashPoint!: string; // 8 decimals string

  @IsString()
  serverSeedHash!: string;

  @IsNumber()
  gameIndex!: number;

  @IsString()
  crashedAt!: string; // ISO date string to match REST

  // For user-specific events: indicates if the current user won (only present if user participated)
  @IsOptional()
  @IsBoolean()
  isUserBetWin?: boolean;

  @IsOptional()
  @IsString()
  betId?: string; // user's bet id if they participated

  @IsOptional()
  @IsString()
  cashOutAt?: string; // user's cashout multiplier if they cashed out
}

export class CrashBetDto {
  @IsString()
  id!: string;

  @IsString()
  betAmount!: string;

  @IsOptional()
  @IsString()
  autoCashOutAt?: string;

  @IsEnum(CrashBetStatusEnum)
  status!: CrashBetStatusEnum;

  @IsOptional()
  @IsString()
  cashOutAt?: string;

  @IsOptional()
  @IsString()
  winAmount?: string;
}

export class JoinCrashRoomDto {
  @IsString()
  userId!: string;
}

export class PlaceCrashBetWebSocketDto {
  @IsString()
  userId!: string;

  @IsString()
  betAmount!: string;

  @IsOptional()
  @IsString()
  autoCashOutAt?: string;
}

export class CashOutWebSocketDto {
  @IsString()
  userId!: string;

  @IsString()
  betId!: string;
}
