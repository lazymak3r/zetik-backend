/**
 * Translation keys for error messages
 * These keys should correspond to translations in the frontend i18n system
 */
export const ERROR_MESSAGES = {
  // Authentication errors
  AUTH: {
    INVALID_CREDENTIALS: 'auth.error.invalid_credentials',
    USER_BANNED: 'auth.error.user_banned',
    INVALID_REFRESH_TOKEN: 'auth.error.invalid_refresh_token',
    INVALID_LOGIN_METHOD: 'auth.error.invalid_login_method',
    JWT_SECRETS_NOT_CONFIGURED: 'auth.error.jwt_secrets_not_configured',
  },

  // Validation errors
  VALIDATION: {
    INVALID_UUID: 'validation.error.invalid_uuid',
    INVALID_EMAIL: 'validation.error.invalid_email',
    INVALID_PASSWORD: 'validation.error.invalid_password',
    INVALID_USERNAME: 'validation.error.invalid_username',
    INVALID_ASSET: 'validation.error.invalid_asset',
    INVALID_AMOUNT_FORMAT: 'validation.error.invalid_amount_format',
    INVALID_AMOUNT_PRECISION: 'validation.error.invalid_amount_precision',
    INVALID_ADDRESS_FORMAT: 'validation.error.invalid_address_format',
    AMOUNT_TOO_SMALL: 'validation.error.amount_too_small',
    AMOUNT_TOO_LARGE: 'validation.error.amount_too_large',
    REQUIRED_FIELD: 'validation.error.required_field',
  },

  // Financial operation errors
  FINANCIAL: {
    INSUFFICIENT_BALANCE: 'financial.error.insufficient_balance',
    DEPOSIT_AMOUNT_TOO_SMALL: 'financial.error.deposit_amount_too_small',
    DEPOSIT_AMOUNT_TOO_LARGE: 'financial.error.deposit_amount_too_large',
    WITHDRAW_AMOUNT_TOO_SMALL: 'financial.error.withdraw_amount_too_small',
    WITHDRAW_AMOUNT_TOO_LARGE: 'financial.error.withdraw_amount_too_large',
    BET_AMOUNT_TOO_SMALL: 'financial.error.bet_amount_too_small',
    BET_AMOUNT_TOO_LARGE: 'financial.error.bet_amount_too_large',
    BET_AMOUNT_INVALID: 'financial.error.bet_amount_invalid',
    DAILY_WITHDRAW_LIMIT_EXCEEDED: 'financial.error.daily_withdraw_limit_exceeded',
    BALANCE_NEGATIVE: 'financial.error.balance_negative',
    BALANCE_EXCEEDS_MAXIMUM: 'financial.error.balance_exceeds_maximum',
    PRECISION_EXCEEDS_MAXIMUM: 'financial.error.precision_exceeds_maximum',
    ASSET_NOT_SUPPORTED: 'financial.error.asset_not_supported',
    INVALID_OPERATION: 'financial.error.invalid_operation',
  },

  // Payment system errors
  PAYMENTS: {
    WALLET_NOT_FOUND: 'payments.error.wallet_not_found',
    ADDRESS_GENERATION_FAILED: 'payments.error.address_generation_failed',
    QR_CODE_GENERATION_FAILED: 'payments.error.qr_code_generation_failed',
    TRANSACTION_NOT_FOUND: 'payments.error.transaction_not_found',
    WITHDRAW_REQUEST_NOT_FOUND: 'payments.error.withdraw_request_not_found',
    WITHDRAW_REQUEST_NOT_PENDING: 'payments.error.withdraw_request_not_pending',
    INVALID_WITHDRAWAL_PARAMETERS: 'payments.error.invalid_withdrawal_parameters',
    FIREBLOCKS_TRANSACTION_FAILED: 'payments.error.fireblocks_transaction_failed',
    WITHDRAW_REQUEST_CREATION_FAILED: 'payments.error.withdraw_request_creation_failed',
    WITHDRAW_APPROVAL_FAILED: 'payments.error.withdraw_approval_failed',
    WITHDRAW_REJECTION_FAILED: 'payments.error.withdraw_rejection_failed',
  },

  // System errors
  SYSTEM: {
    INTERNAL_SERVER_ERROR: 'system.error.internal_server_error',
    DATABASE_ERROR: 'system.error.database_error',
    DATABASE_TRANSACTION_ERROR: 'system.error.database_transaction_error',
    FAILED_TO_UPDATE_BALANCE: 'system.error.failed_to_update_balance',
    FAILED_TO_PROCESS_TRANSACTIONS: 'system.error.failed_to_process_transactions',
    RESOURCE_NOT_FOUND: 'system.error.resource_not_found',
    RESOURCE_CONFLICT: 'system.error.resource_conflict',
    INVALID_REQUEST: 'system.error.invalid_request',
    ACCESS_DENIED: 'system.error.access_denied',
    AUTHENTICATION_REQUIRED: 'system.error.authentication_required',
    TOO_MANY_REQUESTS: 'system.error.too_many_requests',
  },

  // User management errors
  USER: {
    EMAIL_ALREADY_EXISTS: 'user.error.email_already_exists',
    USERNAME_ALREADY_EXISTS: 'user.error.username_already_exists',
    USER_NOT_FOUND: 'user.error.user_not_found',
    USER_CREATION_FAILED: 'user.error.creation_failed',
  },
} as const;

// Helper type for error message keys
export type ErrorMessageKey =
  (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES][keyof (typeof ERROR_MESSAGES)[keyof typeof ERROR_MESSAGES]];
