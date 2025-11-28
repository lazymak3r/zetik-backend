/**
 * LockKeyBuilder - Utility class for consistent distributed lock key generation
 *
 * This class provides static methods to generate standardized lock keys for various
 * operations across the application. Using this builder ensures consistency in lock
 * key patterns and prevents errors from manual string concatenation.
 *
 * Key Design Principles:
 * - All methods validate inputs to prevent invalid lock keys
 * - Colons (:) are used as delimiters and are not allowed in parameter values
 * - Lock keys follow a hierarchical pattern: {domain}:{operation}:{identifiers}
 *
 * @example
 * ```typescript
 * // Balance operations
 * const key = LockKeyBuilder.balanceUser('user123', 'USDC');
 * // Returns: 'balance:user:user123:USDC'
 *
 * // Payment webhooks
 * const key = LockKeyBuilder.paymentWebhook('tx-abc-123');
 * // Returns: 'payment:webhook:tx-abc-123'
 * ```
 */
export class LockKeyBuilder {
  /**
   * Balance operation lock for single user-asset combination
   * Used for operations that modify a user's balance for a specific asset
   *
   * Pattern: balance:user:{userId}:{asset}
   *
   * @param userId - The user ID
   * @param asset - The asset symbol (e.g., 'USDC', 'ETH')
   * @returns Formatted lock key
   * @throws Error if userId or asset is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.balanceUser('user123', 'USDC');
   * // 'balance:user:user123:USDC'
   * ```
   */
  static balanceUser(userId: string, asset: string): string {
    this.validate(userId, 'userId');
    this.validate(asset, 'asset');
    return `balance:user:${userId}:${asset}`;
  }

  /**
   * Vault operation lock (deposit/withdraw)
   * Used for operations that interact with Fireblocks vaults
   *
   * Pattern: balance:vault:{userId}:{asset}
   *
   * @param userId - The user ID
   * @param asset - The asset symbol (e.g., 'USDC', 'ETH')
   * @returns Formatted lock key
   * @throws Error if userId or asset is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.balanceVault('user123', 'USDC');
   * // 'balance:vault:user123:USDC'
   * ```
   */
  static balanceVault(userId: string, asset: string): string {
    this.validate(userId, 'userId');
    this.validate(asset, 'asset');
    return `balance:vault:${userId}:${asset}`;
  }

  /**
   * Vault creation lock
   * Used to prevent concurrent vault creation for the same user
   *
   * Pattern: balance:vault:create:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.balanceVaultCreate('user123');
   * // 'balance:vault:create:user123'
   * ```
   */
  static balanceVaultCreate(userId: string): string {
    this.validate(userId, 'userId');
    return `balance:vault:create:${userId}`;
  }

  /**
   * Payment webhook lock
   * Used to prevent duplicate processing of webhook notifications
   *
   * Pattern: payment:webhook:{transactionId}
   *
   * @param transactionId - The transaction ID from the webhook
   * @returns Formatted lock key
   * @throws Error if transactionId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.paymentWebhook('tx-abc-123');
   * // 'payment:webhook:tx-abc-123'
   * ```
   */
  static paymentWebhook(transactionId: string): string {
    this.validate(transactionId, 'transactionId');
    return `payment:webhook:${transactionId}`;
  }

  /**
   * Payment vault creation lock
   * Used to prevent concurrent vault creation for the same user in payment service
   *
   * Pattern: payment:vault:create:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.paymentVaultCreate('user123');
   * // 'payment:vault:create:user123'
   * ```
   */
  static paymentVaultCreate(userId: string): string {
    this.validate(userId, 'userId');
    return `payment:vault:create:${userId}`;
  }

  /**
   * Payment withdrawal lock (approval/rejection)
   * Used for operations that process withdrawal requests
   *
   * Pattern: payment:withdrawal:{withdrawalId}
   *
   * @param withdrawalId - The withdrawal request ID
   * @returns Formatted lock key
   * @throws Error if withdrawalId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.paymentWithdrawal('wd-123');
   * // 'payment:withdrawal:wd-123'
   * ```
   */
  static paymentWithdrawal(withdrawalId: string): string {
    this.validate(withdrawalId, 'withdrawalId');
    return `payment:withdrawal:${withdrawalId}`;
  }

  /**
   * Payment deposit lock
   * Used for operations that process deposit transactions
   *
   * Pattern: payment:deposit:{depositId}
   *
   * @param depositId - The deposit transaction ID
   * @returns Formatted lock key
   * @throws Error if depositId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.paymentDeposit('dep-456');
   * // 'payment:deposit:dep-456'
   * ```
   */
  static paymentDeposit(depositId: string): string {
    this.validate(depositId, 'depositId');
    return `payment:deposit:${depositId}`;
  }

  /**
   * Dice game bet lock
   * Used to prevent concurrent dice bets for the same user
   *
   * Pattern: dice:bet:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameDice('user123');
   * // 'dice:bet:user123'
   * ```
   */
  static gameDice(userId: string): string {
    this.validate(userId, 'userId');
    return `dice:bet:${userId}`;
  }

  /**
   * Blackjack game lock
   * Used to prevent concurrent blackjack game creation/actions for the same user
   *
   * Pattern: blackjack:game:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameBlackjack('user123');
   * // 'blackjack:game:user123'
   * ```
   */
  static gameBlackjack(userId: string): string {
    this.validate(userId, 'userId');
    return `blackjack:game:${userId}`;
  }

  /**
   * Keno game bet lock
   * Used to prevent concurrent keno bets for the same user
   *
   * Pattern: keno:bet:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameKeno('user123');
   * // 'keno:bet:user123'
   * ```
   */
  static gameKeno(userId: string): string {
    this.validate(userId, 'userId');
    return `keno:bet:${userId}`;
  }

  /**
   * Limbo game bet lock
   * Used to prevent concurrent limbo bets for the same user
   *
   * Pattern: limbo:bet:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameLimbo('user123');
   * // 'limbo:bet:user123'
   * ```
   */
  static gameLimbo(userId: string): string {
    this.validate(userId, 'userId');
    return `limbo:bet:${userId}`;
  }

  /**
   * Mines game lock
   * Used to prevent concurrent mines game operations for the same user
   *
   * Pattern: mines:game:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameMines('user123');
   * // 'mines:game:user123'
   * ```
   */
  static gameMines(userId: string): string {
    this.validate(userId, 'userId');
    return `mines:game:${userId}`;
  }

  /**
   * Plinko game bet lock
   * Used to prevent concurrent plinko bets for the same user
   *
   * Pattern: plinko:bet:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gamePlinko('user123');
   * // 'plinko:bet:user123'
   * ```
   */
  static gamePlinko(userId: string): string {
    this.validate(userId, 'userId');
    return `plinko:bet:${userId}`;
  }

  /**
   * Roulette game bet lock
   * Used to prevent concurrent roulette bets for the same user
   *
   * Pattern: roulette:bet:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.gameRoulette('user123');
   * // 'roulette:bet:user123'
   * ```
   */
  static gameRoulette(userId: string): string {
    this.validate(userId, 'userId');
    return `roulette:bet:${userId}`;
  }

  /**
   * Bonus transaction lock
   * Used to prevent duplicate processing of bonus transaction claims
   *
   * Pattern: bonus:transaction:{userId}:{transactionId}
   *
   * @param userId - The user ID
   * @param transactionId - The transaction ID
   * @returns Formatted lock key
   * @throws Error if userId or transactionId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.bonusTransaction('user123', 'tx-456');
   * // 'bonus:transaction:user123:tx-456'
   * ```
   */
  static bonusTransaction(userId: string, transactionId: string): string {
    this.validate(userId, 'userId');
    this.validate(transactionId, 'transactionId');
    return `bonus:transaction:${userId}:${transactionId}`;
  }

  /**
   * Bonus rakeback claim lock
   * Used to prevent concurrent rakeback claims for the same user and asset
   *
   * Pattern: bonus:rakeback:claim:{userId}:{asset}
   *
   * @param userId - The user ID
   * @param asset - The asset symbol (e.g., 'USDC', 'ETH')
   * @returns Formatted lock key
   * @throws Error if userId or asset is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.bonusRakeback('user123', 'USDC');
   * // 'bonus:rakeback:claim:user123:USDC'
   * ```
   */
  static bonusRakeback(userId: string, asset: string): string {
    this.validate(userId, 'userId');
    this.validate(asset, 'asset');
    return `bonus:rakeback:claim:${userId}:${asset}`;
  }

  /**
   * Bonus rakeback claim all lock
   * Used to prevent concurrent claim-all operations for the same user
   *
   * Pattern: bonus:rakeback:claim-all:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.bonusRakebackClaimAll('user123');
   * // 'bonus:rakeback:claim-all:user123'
   * ```
   */
  static bonusRakebackClaimAll(userId: string): string {
    this.validate(userId, 'userId');
    return `bonus:rakeback:claim-all:${userId}`;
  }

  /**
   * Bonus weekly reload lock
   * Used to prevent concurrent weekly reload activations for the same user
   *
   * Pattern: bonus:reload:{userId}
   *
   * @param userId - The user ID
   * @returns Formatted lock key
   * @throws Error if userId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.bonusReload('user123');
   * // 'bonus:reload:user123'
   * ```
   */
  static bonusReload(userId: string): string {
    this.validate(userId, 'userId');
    return `bonus:reload:${userId}`;
  }

  /**
   * Promocode claim lock
   * Used to prevent race conditions when multiple users try to claim the same promocode
   *
   * Pattern: promocode:claim:{promocodeId}
   *
   * @param promocodeId - The promocode ID
   * @returns Formatted lock key
   * @throws Error if promocodeId is invalid
   *
   * @example
   * ```typescript
   * const lockKey = LockKeyBuilder.promocodeClaim('promo-123');
   * // 'promocode:claim:promo-123'
   * ```
   */
  static promocodeClaim(promocodeId: string): string {
    this.validate(promocodeId, 'promocodeId');
    return `promocode:claim:${promocodeId}`;
  }

  /**
   * Validates a parameter value for use in lock keys
   *
   * @param value - The value to validate
   * @param paramName - The parameter name (for error messages)
   * @throws Error if value is invalid
   *
   * Validation rules:
   * - Must be a non-empty string
   * - Must not contain colons (:) as they are used as delimiters
   */
  private static validate(value: string, paramName: string): void {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${paramName} must be a non-empty string`);
    }
    // Prevent colons in values as they're used as delimiters
    if (value.includes(':')) {
      throw new Error(`${paramName} cannot contain colons (:)`);
    }
  }
}
