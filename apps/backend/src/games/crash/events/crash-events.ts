import { AssetTypeEnum } from '@zetik/shared-entities';

export enum CrashEventType {
  // Game lifecycle events
  GAME_WAITING = 'crash:game:waiting',
  GAME_STARTING = 'crash:game:starting',
  GAME_FLYING = 'crash:game:flying',
  GAME_CRASHED = 'crash:game:crashed',
  GAME_ENDED = 'crash:game:ended',

  // Betting events
  BET_PLACED = 'crash:bet:placed',
  BET_CASHED_OUT = 'crash:bet:cashed_out',
  AUTO_CASH_OUT = 'crash:bet:auto_cashed_out',

  // Player events
  PLAYER_JOINED = 'crash:player:joined',
  PLAYER_LEFT = 'crash:player:left',

  // Game updates
  MULTIPLIER_UPDATE = 'crash:multiplier:update',
  BETTING_STATUS = 'crash:betting:status',
}

export interface CrashGameStateEvent {
  type:
    | CrashEventType.GAME_WAITING
    | CrashEventType.GAME_STARTING
    | CrashEventType.GAME_FLYING
    | CrashEventType.GAME_CRASHED
    | CrashEventType.GAME_ENDED;
  data: {
    gameId: string;
    status: string;
    timeRemaining?: number;
    currentMultiplier?: string;
    crashPoint?: string;
    betsCount: number;
    totalBetAmount: string;
    serverSeedHash: string;
    nonce: string;
  };
  timestamp: Date;
}

export interface CrashBetEvent {
  type: CrashEventType.BET_PLACED | CrashEventType.BET_CASHED_OUT | CrashEventType.AUTO_CASH_OUT;
  data: {
    betId: string;
    userId: string;
    username: string;
    userLevel: number;
    asset: AssetTypeEnum;
    betAmount: string;
    cashOutAt?: string;
    winAmount?: string;
    multiplier?: string;
    gameId: string;
  };
  timestamp: Date;
}

export interface CrashPlayerEvent {
  type: CrashEventType.PLAYER_JOINED | CrashEventType.PLAYER_LEFT;
  data: {
    userId: string;
    username?: string;
    playersCount: number;
  };
  timestamp: Date;
}

export interface CrashMultiplierUpdateEvent {
  type: CrashEventType.MULTIPLIER_UPDATE;
  data: {
    gameId: string;
    currentMultiplier: string;
    elapsedTime: number;
  };
  timestamp: Date;
}

export interface CrashBettingStatusEvent {
  type: CrashEventType.BETTING_STATUS;
  data: {
    gameId: string;
    bettingOpen: boolean;
    timeRemaining?: number;
  };
  timestamp: Date;
}

export type CrashEvent =
  | CrashGameStateEvent
  | CrashBetEvent
  | CrashPlayerEvent
  | CrashMultiplierUpdateEvent
  | CrashBettingStatusEvent;

export interface CrashRoomState {
  gameId: string;
  status: string;
  currentMultiplier?: string;
  crashPoint?: string;
  betsCount: number;
  totalBetAmount: string;
  activeBets: Array<{
    userId: string;
    username?: string;
    betAmount: string;
    autoCashOutAt?: string;
    status: string;
  }>;
  playerCount: number;
  timeRemaining?: number;
}
