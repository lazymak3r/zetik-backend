import { CurrencyEnum, FiatFormatEnum } from '@zetik/common';
import {
  AuthStrategyEnum,
  // GameBetLimitsEntity,
  BalanceWalletEntity,
  BonusVipTierEntity,
  GameConfigEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { DeepPartial } from 'typeorm';

/**
 * Test data factory to create consistent mock data across test suites.
 * Provides realistic data that mirrors production scenarios.
 */

// Base User Factory
export const createMockUser = (overrides: DeepPartial<UserEntity> = {}): UserEntity => {
  const baseUser = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    isEmailVerified: false,
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {
      email: 'test@example.com',
      passwordHash: '$2b$12$hashedpassword',
      isEmailVerified: false,
    },
    isBanned: false,
    isPrivate: false,
    emailMarketing: true,
    streamerMode: false,
    excludeFromRain: false,
    hideStatistics: false,
    hideRaceStatistics: false,
    currentFiatFormat: FiatFormatEnum.STANDARD,
    currentCurrency: CurrencyEnum.USD,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    totalWagered: '0',
    totalDeposited: '0',
    totalWithdrawn: '0',
    vipTier: null,
    lastLogin: new Date('2024-01-01T00:00:00Z'),
    ipAddress: '127.0.0.1',
    country: 'US',
    timezone: 'UTC',
  };

  return { ...baseUser, ...overrides } as UserEntity;
};

// Different user types
export const createEmailUser = (overrides: DeepPartial<UserEntity> = {}): UserEntity =>
  createMockUser({
    registrationStrategy: AuthStrategyEnum.EMAIL,
    registrationData: {
      email: 'email@example.com',
      passwordHash: '$2b$12$hashedpassword',
    },
    isEmailVerified: true,
    ...overrides,
  });

export const createMetamaskUser = (overrides: DeepPartial<UserEntity> = {}): UserEntity =>
  createMockUser({
    registrationStrategy: AuthStrategyEnum.METAMASK,
    registrationData: {
      address: '0x1234567890123456789012345678901234567890',
    },
    ...overrides,
  });

export const createGoogleUser = (overrides: DeepPartial<UserEntity> = {}): UserEntity =>
  createMockUser({
    registrationStrategy: AuthStrategyEnum.GOOGLE,
    registrationData: {
      id: 'google-123456789',
      email: 'google@example.com',
      name: 'John Doe',
    },
    email: 'google@example.com',
    isEmailVerified: true,
    ...overrides,
  });

export const createBannedUser = (overrides: DeepPartial<UserEntity> = {}): UserEntity =>
  createMockUser({
    isBanned: true,
    ...overrides,
  });

// VIP Tier Factory
export const createMockVipTier = (
  overrides: DeepPartial<BonusVipTierEntity> = {},
): BonusVipTierEntity => {
  const baseTier = {
    id: 1,
    name: 'Bronze',
    requiredWager: '1000',
    bonusPercentage: '1.5',
    cashbackPercentage: '2.0',
    maxBonus: '100',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...baseTier, ...overrides } as BonusVipTierEntity;
};

// Game Configuration Factory
export const createMockGameConfig = (
  gameType: string,
  overrides: DeepPartial<GameConfigEntity> = {},
): GameConfigEntity => {
  const baseConfig = {
    id: 1,
    gameType,
    houseEdge: '1.5',
    maxMultiplier: '1000',
    isActive: true,
    configuration: {
      minBet: '0.01',
      maxBet: '1000',
      rtp: '98.5',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...baseConfig, ...overrides } as GameConfigEntity;
};

// Balance Wallet Factory
export const createMockBalanceWallet = (
  overrides: DeepPartial<BalanceWalletEntity> = {},
): BalanceWalletEntity => {
  const baseWallet = {
    id: 1,
    userId: 'test-user-id',
    currency: CurrencyEnum.USD,
    balance: '100.00',
    isPrimary: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...baseWallet, ...overrides } as BalanceWalletEntity;
};

// Game-specific test data
export const createBlackjackGameData = () => ({
  gameType: 'blackjack',
  hands: [
    {
      cards: [
        { rank: 'A', suit: 'hearts', value: 11 },
        { rank: 'K', suit: 'spades', value: 10 },
      ],
      score: 21,
      isBlackjack: true,
    },
  ],
  dealerHand: {
    cards: [
      { rank: '10', suit: 'clubs', value: 10 },
      { rank: '7', suit: 'diamonds', value: 7 },
    ],
    score: 17,
  },
});

export const createCrashGameData = () => ({
  gameType: 'crash',
  serverSeed: 'test-server-seed-123',
  clientSeed: 'test-client-seed-456',
  nonce: 1,
  multiplier: 2.5,
  crashed: true,
});

export const createDiceGameData = () => ({
  gameType: 'dice',
  serverSeed: 'dice-server-seed-123',
  clientSeed: 'dice-client-seed-456',
  nonce: 1,
  target: 50.5,
  roll: 42.8,
  won: true,
});

// Financial test data
export const createFinancialTestData = () => ({
  deposits: [
    { amount: '100.00', currency: CurrencyEnum.USD, status: 'completed' },
    { amount: '0.001', currency: 'BTC', status: 'pending' },
  ],
  withdrawals: [{ amount: '50.00', currency: CurrencyEnum.USD, status: 'completed' }],
  bets: [
    { amount: '10.00', currency: CurrencyEnum.USD, gameType: 'blackjack', outcome: 'win' },
    { amount: '5.00', currency: CurrencyEnum.USD, gameType: 'dice', outcome: 'loss' },
  ],
});

// Error scenarios
export const createErrorScenarios = () => ({
  insufficientBalance: {
    userId: 'test-user-id',
    requestedAmount: '1000000.00',
    availableBalance: '10.00',
  },
  invalidBetAmount: {
    betAmount: '-10.00', // Negative amount
  },
  exceededLimits: {
    dailyLimit: '500.00',
    currentDailyWagered: '450.00',
    requestedBet: '100.00',
  },
  bannedUser: createBannedUser(),
});

// Authentication test data
export const createAuthTestData = () => ({
  validTokens: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
  },
  invalidTokens: {
    expiredToken: 'expired.jwt.token',
    malformedToken: 'malformed-token',
    nullToken: null,
  },
  passwords: {
    plaintext: 'SecurePassword123!',
    hashed: '$2b$12$hashedpassword',
    weak: '123',
    long: 'a'.repeat(129), // Exceeds typical password length limits
  },
});

// Test utilities for different currencies
export const createMultiCurrencyTestData = () => ({
  balances: [
    { currency: CurrencyEnum.USD, amount: '1000.00' },
    { currency: 'BTC', amount: '0.5' },
    { currency: 'ETH', amount: '2.0' },
    { currency: 'LTC', amount: '10.0' },
    { currency: 'DOGE', amount: '50000.0' },
  ],
  exchangeRates: {
    [CurrencyEnum.USD]: 1.0,
    BTC: 45000.0,
    ETH: 2500.0,
    LTC: 120.0,
    DOGE: 0.08,
  },
});

// Performance test data
export const createPerformanceTestData = (size: number = 1000) => ({
  users: Array.from({ length: size }, (_, i) =>
    createMockUser({
      id: `user-${i}`,
      username: `user${i}`,
      email: `user${i}@example.com`,
    }),
  ),
  bets: Array.from({ length: size * 10 }, (_, i) => ({
    id: `bet-${i}`,
    userId: `user-${Math.floor(i / 10)}`,
    amount: (Math.random() * 100).toFixed(2),
    gameType: ['blackjack', 'dice', 'crash'][i % 3],
  })),
});
