import { St8BonusStatusEnum, St8ProviderTransactionEnum } from '../enums/st8.enum';

export interface ISt8PayoutInput {
  player: string;
  site: string;
  transaction_id: string;
  amount: string;
  currency: string;
  game_code: string | null;
  developer_code: string;
  provider_kind: St8ProviderTransactionEnum;
  provider: {
    transaction_id: string;
    amount: string;
    currency: string;
    player: string | null;
  };
  bonus: {
    instance_id: string;
    status: St8BonusStatusEnum;
    bonus_id: string;
  } | null;
}
