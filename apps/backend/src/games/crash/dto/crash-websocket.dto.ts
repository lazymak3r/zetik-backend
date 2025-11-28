import { IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class JoinCrashRoomDto {
  @IsOptional()
  @IsString()
  gameId?: string;
}

export class PlaceBetWebSocketDto {
  @IsString()
  betAmount!: string;

  @IsOptional()
  @IsString()
  autoCashOutAt?: string;
}

export class CashOutWebSocketDto {
  @IsUUID()
  betId!: string;
}

export class GetCrashHistoryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
