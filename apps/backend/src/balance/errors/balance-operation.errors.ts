import { BalanceOperationResultEnum } from '@zetik/shared-entities';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

/**
 * Base class for balance operation errors
 */
export class BalanceOperationError extends Error {
  constructor(
    public readonly code: BalanceOperationResultEnum,
    message: string,
  ) {
    super(message);
    this.name = 'BalanceOperationError';
  }
}

export class InsufficientBalanceError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.INSUFFICIENT_BALANCE) {
    super(BalanceOperationResultEnum.INSUFFICIENT_BALANCE, message);
    this.name = 'InsufficientBalanceError';
  }
}

export class DailyLimitReachedError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.DAILY_WITHDRAW_LIMIT_EXCEEDED) {
    super(BalanceOperationResultEnum.DAILY_LIMIT_REACHED, message);
    this.name = 'DailyLimitReachedError';
  }
}

export class WalletNotFoundError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.PAYMENTS.WALLET_NOT_FOUND) {
    super(BalanceOperationResultEnum.WALLET_NOT_FOUND, message);
    this.name = 'WalletNotFoundError';
  }
}

export class InvalidOperationError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.INVALID_OPERATION) {
    super(BalanceOperationResultEnum.INVALID_OPERATION, message);
    this.name = 'InvalidOperationError';
  }
}

export class BalanceNegativeError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.BALANCE_NEGATIVE) {
    super(BalanceOperationResultEnum.BALANCE_NEGATIVE, message);
    this.name = 'BalanceNegativeError';
  }
}

export class BalanceExceedsMaximumError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.BALANCE_EXCEEDS_MAXIMUM) {
    super(BalanceOperationResultEnum.BALANCE_EXCEEDS_MAXIMUM, message);
    this.name = 'BalanceExceedsMaximumError';
  }
}

export class AssetNotSupportedError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.ASSET_NOT_SUPPORTED) {
    super(BalanceOperationResultEnum.ASSET_NOT_SUPPORTED, message);
    this.name = 'AssetNotSupportedError';
  }
}

export class PrecisionExceedsMaximumError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.PRECISION_EXCEEDS_MAXIMUM) {
    super(BalanceOperationResultEnum.PRECISION_EXCEEDS_MAXIMUM, message);
    this.name = 'PrecisionExceedsMaximumError';
  }
}

export class DepositAmountTooSmallError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.DEPOSIT_AMOUNT_TOO_SMALL) {
    super(BalanceOperationResultEnum.DEPOSIT_AMOUNT_TOO_SMALL, message);
    this.name = 'DepositAmountTooSmallError';
  }
}

export class DepositAmountTooLargeError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.DEPOSIT_AMOUNT_TOO_LARGE) {
    super(BalanceOperationResultEnum.DEPOSIT_AMOUNT_TOO_LARGE, message);
    this.name = 'DepositAmountTooLargeError';
  }
}

export class WithdrawAmountTooSmallError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.WITHDRAW_AMOUNT_TOO_SMALL) {
    super(BalanceOperationResultEnum.WITHDRAW_AMOUNT_TOO_SMALL, message);
    this.name = 'WithdrawAmountTooSmallError';
  }
}

export class WithdrawAmountTooLargeError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.FINANCIAL.WITHDRAW_AMOUNT_TOO_LARGE) {
    super(BalanceOperationResultEnum.WITHDRAW_AMOUNT_TOO_LARGE, message);
    this.name = 'WithdrawAmountTooLargeError';
  }
}

export class DatabaseTransactionError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.SYSTEM.DATABASE_TRANSACTION_ERROR) {
    super(BalanceOperationResultEnum.DATABASE_TRANSACTION_ERROR, message);
    this.name = 'DatabaseTransactionError';
  }
}

export class OperationExistsError extends BalanceOperationError {
  constructor(message: string = 'Operation already exists') {
    super(BalanceOperationResultEnum.OPERATION_EXISTS, message);
    this.name = 'OperationExistsError';
  }
}

export class UserBannedError extends BalanceOperationError {
  constructor(message: string = ERROR_MESSAGES.AUTH.USER_BANNED) {
    super(BalanceOperationResultEnum.USER_BANNED, message);
    this.name = 'UserBannedError';
  }
}
