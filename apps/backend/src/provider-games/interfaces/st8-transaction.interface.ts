import { St8BonusStatusEnum, St8ProviderTransactionEnum } from '../enums/st8.enum';

export interface ISt8ProviderInfo {
  transaction_id: string;
  amount: string;
  currency: string;
  player: string | null;
  round?: string;
}

export interface ISt8BonusInfo {
  instance_id: string;
  status: St8BonusStatusEnum;
  bonus_id: string;
}

export interface ISt8TransactionInput {
  player: string;
  site: string;
  token: string;
  transaction_id: string;
  round: string;
  round_closed: boolean | null;
  game_code: string;
  developer_code: string;
  amount: string;
  currency: string;
  provider_kind: St8ProviderTransactionEnum;
  provider: ISt8ProviderInfo;
  bonus: ISt8BonusInfo | null;
}
