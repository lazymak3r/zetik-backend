import { LockKeyBuilder } from './lock-key-builder';

describe('LockKeyBuilder', () => {
  describe('balanceUser', () => {
    it('should generate correct lock key for valid inputs', () => {
      const result = LockKeyBuilder.balanceUser('user123', 'USDC');
      expect(result).toBe('balance:user:user123:USDC');
    });

    it('should handle different asset types', () => {
      expect(LockKeyBuilder.balanceUser('user456', 'ETH')).toBe('balance:user:user456:ETH');
      expect(LockKeyBuilder.balanceUser('user789', 'BTC')).toBe('balance:user:user789:BTC');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.balanceUser('', 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.balanceUser('   ', 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for empty asset', () => {
      expect(() => LockKeyBuilder.balanceUser('user123', '')).toThrow(
        'asset must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.balanceUser('user:123', 'USDC')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for asset containing colon', () => {
      expect(() => LockKeyBuilder.balanceUser('user123', 'USD:C')).toThrow(
        'asset cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.balanceUser(null as any, 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for undefined asset', () => {
      expect(() => LockKeyBuilder.balanceUser('user123', undefined as any)).toThrow(
        'asset must be a non-empty string',
      );
    });
  });

  describe('balanceVault', () => {
    it('should generate correct lock key for valid inputs', () => {
      const result = LockKeyBuilder.balanceVault('user123', 'USDC');
      expect(result).toBe('balance:vault:user123:USDC');
    });

    it('should handle different user IDs and assets', () => {
      expect(LockKeyBuilder.balanceVault('abc', 'ETH')).toBe('balance:vault:abc:ETH');
      expect(LockKeyBuilder.balanceVault('xyz', 'BTC')).toBe('balance:vault:xyz:BTC');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.balanceVault('', 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for empty asset', () => {
      expect(() => LockKeyBuilder.balanceVault('user123', '')).toThrow(
        'asset must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.balanceVault('user:123', 'USDC')).toThrow(
        'userId cannot contain colons (:)',
      );
    });
  });

  describe('balanceVaultCreate', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.balanceVaultCreate('user123');
      expect(result).toBe('balance:vault:create:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.balanceVaultCreate('abc')).toBe('balance:vault:create:abc');
      expect(LockKeyBuilder.balanceVaultCreate('user-456')).toBe('balance:vault:create:user-456');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.balanceVaultCreate('')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.balanceVaultCreate('  ')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.balanceVaultCreate('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.balanceVaultCreate(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('paymentWebhook', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.paymentWebhook('tx-abc-123');
      expect(result).toBe('payment:webhook:tx-abc-123');
    });

    it('should handle different transaction ID formats', () => {
      expect(LockKeyBuilder.paymentWebhook('uuid-1234-5678')).toBe(
        'payment:webhook:uuid-1234-5678',
      );
      expect(LockKeyBuilder.paymentWebhook('tx_simple')).toBe('payment:webhook:tx_simple');
    });

    it('should throw error for empty transactionId', () => {
      expect(() => LockKeyBuilder.paymentWebhook('')).toThrow(
        'transactionId must be a non-empty string',
      );
    });

    it('should throw error for transactionId containing colon', () => {
      expect(() => LockKeyBuilder.paymentWebhook('tx:123')).toThrow(
        'transactionId cannot contain colons (:)',
      );
    });

    it('should throw error for undefined transactionId', () => {
      expect(() => LockKeyBuilder.paymentWebhook(undefined as any)).toThrow(
        'transactionId must be a non-empty string',
      );
    });
  });

  describe('paymentVaultCreate', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.paymentVaultCreate('user123');
      expect(result).toBe('payment:vault:create:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.paymentVaultCreate('abc')).toBe('payment:vault:create:abc');
      expect(LockKeyBuilder.paymentVaultCreate('user-789')).toBe('payment:vault:create:user-789');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.paymentVaultCreate('')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.paymentVaultCreate('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });
  });

  describe('paymentWithdrawal', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.paymentWithdrawal('wd-123');
      expect(result).toBe('payment:withdrawal:wd-123');
    });

    it('should handle different withdrawal ID formats', () => {
      expect(LockKeyBuilder.paymentWithdrawal('withdrawal-456')).toBe(
        'payment:withdrawal:withdrawal-456',
      );
      expect(LockKeyBuilder.paymentWithdrawal('uuid-abc-def')).toBe(
        'payment:withdrawal:uuid-abc-def',
      );
    });

    it('should throw error for empty withdrawalId', () => {
      expect(() => LockKeyBuilder.paymentWithdrawal('')).toThrow(
        'withdrawalId must be a non-empty string',
      );
    });

    it('should throw error for withdrawalId containing colon', () => {
      expect(() => LockKeyBuilder.paymentWithdrawal('wd:123')).toThrow(
        'withdrawalId cannot contain colons (:)',
      );
    });

    it('should throw error for null withdrawalId', () => {
      expect(() => LockKeyBuilder.paymentWithdrawal(null as any)).toThrow(
        'withdrawalId must be a non-empty string',
      );
    });
  });

  describe('paymentDeposit', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.paymentDeposit('dep-456');
      expect(result).toBe('payment:deposit:dep-456');
    });

    it('should handle different deposit ID formats', () => {
      expect(LockKeyBuilder.paymentDeposit('deposit-123')).toBe('payment:deposit:deposit-123');
      expect(LockKeyBuilder.paymentDeposit('tx-abc-789')).toBe('payment:deposit:tx-abc-789');
    });

    it('should throw error for empty depositId', () => {
      expect(() => LockKeyBuilder.paymentDeposit('')).toThrow(
        'depositId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only depositId', () => {
      expect(() => LockKeyBuilder.paymentDeposit('   ')).toThrow(
        'depositId must be a non-empty string',
      );
    });

    it('should throw error for depositId containing colon', () => {
      expect(() => LockKeyBuilder.paymentDeposit('dep:456')).toThrow(
        'depositId cannot contain colons (:)',
      );
    });

    it('should throw error for undefined depositId', () => {
      expect(() => LockKeyBuilder.paymentDeposit(undefined as any)).toThrow(
        'depositId must be a non-empty string',
      );
    });
  });

  describe('Lock key uniqueness', () => {
    it('should generate different keys for different methods with same parameters', () => {
      const balanceKey = LockKeyBuilder.balanceUser('user123', 'USDC');
      const vaultKey = LockKeyBuilder.balanceVault('user123', 'USDC');

      expect(balanceKey).not.toBe(vaultKey);
      expect(balanceKey).toBe('balance:user:user123:USDC');
      expect(vaultKey).toBe('balance:vault:user123:USDC');
    });

    it('should generate different keys for vault creation in different domains', () => {
      const balanceVault = LockKeyBuilder.balanceVaultCreate('user123');
      const paymentVault = LockKeyBuilder.paymentVaultCreate('user123');

      expect(balanceVault).not.toBe(paymentVault);
      expect(balanceVault).toBe('balance:vault:create:user123');
      expect(paymentVault).toBe('payment:vault:create:user123');
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric string inputs', () => {
      expect(LockKeyBuilder.balanceUser('12345', '67890')).toBe('balance:user:12345:67890');
    });

    it('should handle special characters except colon', () => {
      expect(LockKeyBuilder.balanceUser('user-123', 'USD_C')).toBe('balance:user:user-123:USD_C');
      expect(LockKeyBuilder.paymentWebhook('tx.abc.123')).toBe('payment:webhook:tx.abc.123');
    });

    it('should handle very long identifiers', () => {
      const longId = 'a'.repeat(100);
      const result = LockKeyBuilder.balanceUser(longId, 'USDC');
      expect(result).toBe(`balance:user:${longId}:USDC`);
    });
  });

  describe('gameDice', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameDice('user123');
      expect(result).toBe('dice:bet:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameDice('player-456')).toBe('dice:bet:player-456');
      expect(LockKeyBuilder.gameDice('uuid-abc-def')).toBe('dice:bet:uuid-abc-def');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameDice('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.gameDice('   ')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameDice('user:123')).toThrow('userId cannot contain colons (:)');
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.gameDice(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for undefined userId', () => {
      expect(() => LockKeyBuilder.gameDice(undefined as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gameBlackjack', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameBlackjack('user123');
      expect(result).toBe('blackjack:game:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameBlackjack('player-789')).toBe('blackjack:game:player-789');
      expect(LockKeyBuilder.gameBlackjack('abc')).toBe('blackjack:game:abc');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameBlackjack('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameBlackjack('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.gameBlackjack(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gameKeno', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameKeno('user123');
      expect(result).toBe('keno:bet:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameKeno('player-321')).toBe('keno:bet:player-321');
      expect(LockKeyBuilder.gameKeno('xyz')).toBe('keno:bet:xyz');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameKeno('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.gameKeno('  ')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameKeno('user:123')).toThrow('userId cannot contain colons (:)');
    });

    it('should throw error for undefined userId', () => {
      expect(() => LockKeyBuilder.gameKeno(undefined as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gameLimbo', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameLimbo('user123');
      expect(result).toBe('limbo:bet:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameLimbo('player-654')).toBe('limbo:bet:player-654');
      expect(LockKeyBuilder.gameLimbo('test-user')).toBe('limbo:bet:test-user');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameLimbo('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameLimbo('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.gameLimbo(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gameMines', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameMines('user123');
      expect(result).toBe('mines:game:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameMines('player-987')).toBe('mines:game:player-987');
      expect(LockKeyBuilder.gameMines('miner-1')).toBe('mines:game:miner-1');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameMines('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.gameMines('   ')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameMines('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for undefined userId', () => {
      expect(() => LockKeyBuilder.gameMines(undefined as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gamePlinko', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gamePlinko('user123');
      expect(result).toBe('plinko:bet:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gamePlinko('player-111')).toBe('plinko:bet:player-111');
      expect(LockKeyBuilder.gamePlinko('plinko-fan')).toBe('plinko:bet:plinko-fan');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gamePlinko('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gamePlinko('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.gamePlinko(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('gameRoulette', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.gameRoulette('user123');
      expect(result).toBe('roulette:bet:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.gameRoulette('player-222')).toBe('roulette:bet:player-222');
      expect(LockKeyBuilder.gameRoulette('spinner')).toBe('roulette:bet:spinner');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.gameRoulette('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.gameRoulette('  ')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.gameRoulette('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for undefined userId', () => {
      expect(() => LockKeyBuilder.gameRoulette(undefined as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('bonusTransaction', () => {
    it('should generate correct lock key for valid inputs', () => {
      const result = LockKeyBuilder.bonusTransaction('user123', 'tx-456');
      expect(result).toBe('bonus:transaction:user123:tx-456');
    });

    it('should handle different user IDs and transaction IDs', () => {
      expect(LockKeyBuilder.bonusTransaction('player-789', 'transaction-abc')).toBe(
        'bonus:transaction:player-789:transaction-abc',
      );
      expect(LockKeyBuilder.bonusTransaction('abc', 'xyz')).toBe('bonus:transaction:abc:xyz');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.bonusTransaction('', 'tx-456')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for empty transactionId', () => {
      expect(() => LockKeyBuilder.bonusTransaction('user123', '')).toThrow(
        'transactionId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.bonusTransaction('   ', 'tx-456')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only transactionId', () => {
      expect(() => LockKeyBuilder.bonusTransaction('user123', '   ')).toThrow(
        'transactionId must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.bonusTransaction('user:123', 'tx-456')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for transactionId containing colon', () => {
      expect(() => LockKeyBuilder.bonusTransaction('user123', 'tx:456')).toThrow(
        'transactionId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.bonusTransaction(null as any, 'tx-456')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for undefined transactionId', () => {
      expect(() => LockKeyBuilder.bonusTransaction('user123', undefined as any)).toThrow(
        'transactionId must be a non-empty string',
      );
    });
  });

  describe('bonusRakeback', () => {
    it('should generate correct lock key for valid inputs', () => {
      const result = LockKeyBuilder.bonusRakeback('user123', 'USDC');
      expect(result).toBe('bonus:rakeback:claim:user123:USDC');
    });

    it('should handle different user IDs and assets', () => {
      expect(LockKeyBuilder.bonusRakeback('player-456', 'ETH')).toBe(
        'bonus:rakeback:claim:player-456:ETH',
      );
      expect(LockKeyBuilder.bonusRakeback('abc', 'BTC')).toBe('bonus:rakeback:claim:abc:BTC');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.bonusRakeback('', 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for empty asset', () => {
      expect(() => LockKeyBuilder.bonusRakeback('user123', '')).toThrow(
        'asset must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.bonusRakeback('   ', 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for whitespace-only asset', () => {
      expect(() => LockKeyBuilder.bonusRakeback('user123', '  ')).toThrow(
        'asset must be a non-empty string',
      );
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.bonusRakeback('user:123', 'USDC')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for asset containing colon', () => {
      expect(() => LockKeyBuilder.bonusRakeback('user123', 'USD:C')).toThrow(
        'asset cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.bonusRakeback(null as any, 'USDC')).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for undefined asset', () => {
      expect(() => LockKeyBuilder.bonusRakeback('user123', undefined as any)).toThrow(
        'asset must be a non-empty string',
      );
    });
  });

  describe('bonusReload', () => {
    it('should generate correct lock key for valid input', () => {
      const result = LockKeyBuilder.bonusReload('user123');
      expect(result).toBe('bonus:reload:user123');
    });

    it('should handle different user IDs', () => {
      expect(LockKeyBuilder.bonusReload('player-789')).toBe('bonus:reload:player-789');
      expect(LockKeyBuilder.bonusReload('reload-user')).toBe('bonus:reload:reload-user');
    });

    it('should throw error for empty userId', () => {
      expect(() => LockKeyBuilder.bonusReload('')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for whitespace-only userId', () => {
      expect(() => LockKeyBuilder.bonusReload('   ')).toThrow('userId must be a non-empty string');
    });

    it('should throw error for userId containing colon', () => {
      expect(() => LockKeyBuilder.bonusReload('user:123')).toThrow(
        'userId cannot contain colons (:)',
      );
    });

    it('should throw error for null userId', () => {
      expect(() => LockKeyBuilder.bonusReload(null as any)).toThrow(
        'userId must be a non-empty string',
      );
    });

    it('should throw error for undefined userId', () => {
      expect(() => LockKeyBuilder.bonusReload(undefined as any)).toThrow(
        'userId must be a non-empty string',
      );
    });
  });

  describe('Game lock key uniqueness', () => {
    it('should generate different keys for different games with same user', () => {
      const userId = 'user123';
      const diceKey = LockKeyBuilder.gameDice(userId);
      const blackjackKey = LockKeyBuilder.gameBlackjack(userId);
      const kenoKey = LockKeyBuilder.gameKeno(userId);
      const limboKey = LockKeyBuilder.gameLimbo(userId);
      const minesKey = LockKeyBuilder.gameMines(userId);
      const plinkoKey = LockKeyBuilder.gamePlinko(userId);
      const rouletteKey = LockKeyBuilder.gameRoulette(userId);

      const allKeys = [diceKey, blackjackKey, kenoKey, limboKey, minesKey, plinkoKey, rouletteKey];
      const uniqueKeys = new Set(allKeys);

      expect(uniqueKeys.size).toBe(allKeys.length);
      expect(diceKey).toBe('dice:bet:user123');
      expect(blackjackKey).toBe('blackjack:game:user123');
      expect(kenoKey).toBe('keno:bet:user123');
      expect(limboKey).toBe('limbo:bet:user123');
      expect(minesKey).toBe('mines:game:user123');
      expect(plinkoKey).toBe('plinko:bet:user123');
      expect(rouletteKey).toBe('roulette:bet:user123');
    });

    it('should generate different keys for different bonus operations with same user', () => {
      const userId = 'user123';
      const transactionKey = LockKeyBuilder.bonusTransaction(userId, 'tx-1');
      const rakebackKey = LockKeyBuilder.bonusRakeback(userId, 'USDC');
      const reloadKey = LockKeyBuilder.bonusReload(userId);

      expect(transactionKey).not.toBe(rakebackKey);
      expect(transactionKey).not.toBe(reloadKey);
      expect(rakebackKey).not.toBe(reloadKey);
      expect(transactionKey).toBe('bonus:transaction:user123:tx-1');
      expect(rakebackKey).toBe('bonus:rakeback:claim:user123:USDC');
      expect(reloadKey).toBe('bonus:reload:user123');
    });
  });
});
