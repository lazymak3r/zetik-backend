import { St8ProviderTransactionEnum } from '../enums/st8.enum';

export interface ISt8BuyinInput {
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
}
