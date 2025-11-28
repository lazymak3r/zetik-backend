export enum St8Jurisdiction {
  'CW' = 'CW',
  'IOM' = 'IoM',
  'MGA' = 'MGA',
  'PAGCOR' = 'Pagcor',
  'EMTA' = 'EMTA',
  'SGA' = 'SGA',
  'UKGC' = 'UKGC',
}

export interface ISt8LaunchGameInput {
  game_code: string;
  currency: string;
  site: {
    id: string;
    lobby: string;
    deposit: string;
  };
  token: string;
  player: string | null;
  country: string | null;
  lang: string | null;
  device: 'DESKTOP' | 'MOBILE' | null;
  fun_mode: boolean | null;
  player_profile: {
    id: string;
    jurisdiction: St8Jurisdiction;
    default_currency: string;
    reg_country: string;
    affiliate: null;
    bet_limits: 'low' | 'medium' | 'high';
    birth_date: string;
    reg_date: string;
    attributes: {
      labels: string[];
    } | null;
  };
}

export interface ISt8LaunchGameResponse {
  game_url: string;
  token: string;
}

export interface ISt8GamesResponse {
  status: 'ok' | 'error';
  games: {
    code: string;
    name: string;
    enabled: boolean;
    developer: string;
    bonus_types: ('free_bets' | 'free_spins' | 'bonus_game')[];
    category: string;
    themes: string[];
    features: string[];
    rtp: number | null;
    volatility: number | null;
    max_payout_coeff: string;
    hit_ratio: string;
    fun_mode: boolean;
    release_date: string | null;
    deprecation_date: string | null;
    restricted_territories: string[];
    prohibited_territories: string[];
  }[];
  developers: {
    name: string;
    code: string;
    restricted_territories: string[];
    prohibited_territories: string[];
  }[];
  categories: {
    name: string;
    type: string;
  }[];
}

export enum St8BonusType {
  FREE_BETS = 'free_bets',
  FREE_MONEY = 'free_money',
  BONUS_GAME = 'bonus_game',
  BETBY = 'betby',
}

export interface ISt8GetOffersParams {
  /** Comma separated list of unique game identifiers in St8 system */
  game_codes?: string[];
  /** Currency code of bonus offer. MUST comply with ISO 4217 Alpha-3 standard */
  currency?: string;
  /** Type of bonus offer */
  type?: St8BonusType;
  /** Operator's unique ID for site where games are played */
  site?: string;
}

export interface ISt8CreateBonusParams {
  /** Unique bonus ID within Operator's platform. This ID is used as idempotency key */
  bonus_id: string;
  /** Array of game_code. These are unique identifiers of the games in St8 system */
  game_codes: string[];
  /** Currency code of bonus offer. MUST comply with ISO 4217 Alpha-3 standard */
  currency: string;
  /** Monetary value of the bonus offer. Sent as stringified float value */
  value: string;
  /** Type of bonus offer */
  type: St8BonusType;
  /** Array of players. Which are unique player IDs on Operator's platform */
  players: string[];
  /** Number of free bets. Supported only by offers of free_bets type */
  count?: number;
  /** Operator's site where game is being played */
  site?: string;
  /** Date and time when bonus becomes active. Must be UTC timestamp and encoded according to ISO 8601 */
  start_time?: string;
  /** For how long (in seconds) since the start_time bonus is supposed to be active */
  duration?: number;
}

export interface ISt8BonusInstance {
  instance_id: string;
  player: string;
  status: string;
  start_time: string;
  end_time: string;
}

export interface ISt8BonusInfo {
  bonus_id: string;
  status: string;
  instances?: ISt8BonusInstance[];
}

export interface ISt8BonusResponse {
  status: string;
  bonus: ISt8BonusInfo;
}
