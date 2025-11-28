/**
 * Email template names used in Mailgun
 * These template names should match the templates configured in Mailgun dashboard
 */
export enum EmailTemplateEnum {
  // Authentication templates
  EMAIL_VERIFICATION = 'email-verification',
  PASSWORD_RESET = 'password-reset',

  // Self-exclusion templates
  SELF_EXCLUSION_COOLDOWN = 'self-exclusion-cooldown',
  SELF_EXCLUSION_EXTENDED = 'self-exclusion-extended',
  SELF_EXCLUSION_PERMANENT = 'self-exclusion-permanent',

  // Withdrawal templates
  WITHDRAWAL_PENDING = 'withdrawal_pending',
  WITHDRAWAL_PROCESSING = 'withdrawal_processing',
  WITHDRAWAL_APPROVED = 'withdrawal_approved',
  WITHDRAWAL_REJECTED = 'withdrawal_rejected',
  WITHDRAWAL_SENT = 'withdrawal_sent',
  WITHDRAWAL_FAILED = 'withdrawal_failed',

  // Deposit templates
  DEPOSIT_PENDING = 'deposit_pending',
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  DEPOSIT_FAILED = 'deposit_failed',
  DEPOSIT_COMPLETED = 'deposit_completed',
}
