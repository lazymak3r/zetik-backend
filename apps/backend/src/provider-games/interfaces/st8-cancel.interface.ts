export interface ISt8CancelBaseInput {
  player: string;
  cancel_id: string;
  transaction_id: string;
  site: string;
  developer_code: string;
  amount: string;
  currency: string;
}

export interface ISt8CancelExtendedInput extends ISt8CancelBaseInput {
  round: string;
  token: string;
  game_code: string | null;
}
