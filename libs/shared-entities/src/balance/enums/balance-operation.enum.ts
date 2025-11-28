export enum BalanceOperationEnum {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  ROLLBACK_WITHDRAW = 'ROLLBACK_WITHDRAW',
  BUYIN = 'BUYIN',
  PAYOUT = 'PAYOUT',
  BET = 'BET',
  WIN = 'WIN',
  BET_CANCEL = 'BET_CANCEL', // Cancelled bet and buyin
  WIN_CANCEL = 'WIN_CANCEL', // Cancelled win and payout
  CORRECTION_DEBIT = 'CORRECTION_DEBIT', // ST8 specific debit which allows going to minus
  CORRECTION_BUYIN = 'CORRECTION_BUYIN', // ST8 specific buyin which allows going to minus
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  AFFILIATE_CLAIM = 'AFFILIATE_CLAIM', // Transfer earned commissions from affiliate wallet to private wallet
  VAULT_DEPOSIT = 'VAULT_DEPOSIT', // Move funds from main balance to vault
  VAULT_WITHDRAW = 'VAULT_WITHDRAW', // Move funds from vault back to main balance
  TIP_SEND = 'TIP_SEND', // Sender side of a tip (debit)
  TIP_RECEIVE = 'TIP_RECEIVE', // Receiver side of a tip (credit)
  PROMOCODE = 'PROMOCODE',
  RACE_CREATION = 'RACE_CREATION', // Deduct funds to create sponsor race prize pool
  OTHER = 'OTHER',
}
