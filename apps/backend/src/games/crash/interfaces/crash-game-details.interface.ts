import { AssetTypeEnum, CrashBetStatusEnum, CrashGameStatusEnum } from '@zetik/shared-entities';

export interface IUserBet {
  asset: AssetTypeEnum;
  betAmount: string;
  multiplier: string;
  payout: string;
  status: CrashBetStatusEnum;
}

export interface ICrashGameDetails {
  id: string;
  status: CrashGameStatusEnum;
  crashPoint: string;
  serverSeedHash: string;
  nonce: string;
  crashedAt?: Date;
  totalPlayers: number;
  cashedOutPlayers: number;
  userBet?: IUserBet;
}
