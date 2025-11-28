export enum St8ResponseStatusEnum {
  OK = 'ok',
  PLAYER_LOCKED = 'player_locked',
  SESSION_EXPIRED = 'session_expired',
  PLAYER_NOT_FOUND = 'player_not_found',
  NOT_ENOUGH_MONEY = 'not_enough_money',
  TRANSACTION_NOT_FOUND = 'transaction_not_found',
  GAME_DISABLED = 'game_disabled',
  SITE_DISABLED = 'site_disabled',
  SPENDING_LIMIT = 'spending_limit',
  AUTH_FAILED = 'auth_failed',
  UNKNOWN = 'unknown',
}

export enum St8BonusStatusEnum {
  PROCESSING = 'processing',
  FINISHED = 'finished',
  ERROR = 'error',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}

export enum St8ProviderTransactionEnum {
  DEBIT = 'debit',
  CREDIT = 'credit',
  JACKPOT_CREDIT = 'jackpot_credit',
  PROMO_CREDIT = 'promo_credit',
  FREE_DEBIT = 'free_debit',
  FREE_CREDIT = 'free_credit',
  CORRECTION_CREDIT = 'correction_credit',
  CORRECTION_DEBIT = 'correction_debit',
  BONUS_BUY_DEBIT = 'bonus_buy_debit',
  BONUS_BUY_CREDIT = 'bonus_buy_credit',
}
