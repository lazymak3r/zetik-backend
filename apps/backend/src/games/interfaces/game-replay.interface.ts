import { GameTypeEnum } from '@zetik/shared-entities';

export interface IGameReplayStep {
  stepNumber: number;
  timestamp: Date;
  action: string;
  data: Record<string, any>;
}

export interface IGameReplayData {
  gameType: GameTypeEnum;
  steps: IGameReplayStep[];
  provablyFairData?: {
    serverSeed?: string;
    serverSeedHash?: string;
    clientSeed?: string;
    nonce?: string;
  };
}

export interface IGameReplayResponse {
  sessionId: string;
  gameType: GameTypeEnum;
  totalSteps: number;
  duration: number; // milliseconds
  betAmount: string;
  winAmount?: string;
  asset: string;
  isWin: boolean;
  createdAt: Date;
  completedAt?: Date;
  replayData: IGameReplayData;
}

export interface IReplayStepsQuery {
  gameSessionId: string;
  fromStep?: number;
  toStep?: number;
}

export interface IBatchReplayQuery {
  gameSessionIds: string[];
  includeSteps?: boolean;
}
