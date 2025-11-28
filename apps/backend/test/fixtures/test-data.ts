import { AssetTypeEnum, AuthStrategyEnum, BalanceOperationEnum } from '@zetik/shared-entities';
import { randomUUID } from 'crypto';

// Test Users
export const testUsers = {
  player1: {
    id: randomUUID(),
    username: 'player1',
    email: 'player1@test.com',
    password: 'TestPassword123!',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    balance: {
      [AssetTypeEnum.USDT]: '1000.00000000',
      [AssetTypeEnum.BTC]: '0.10000000',
      [AssetTypeEnum.ETH]: '1.00000000',
    },
  },
  player2: {
    id: randomUUID(),
    username: 'player2',
    email: 'player2@test.com',
    password: 'TestPassword123!',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    balance: {
      [AssetTypeEnum.USDT]: '500.00000000',
    },
  },
  bannedUser: {
    id: randomUUID(),
    username: 'banned',
    email: 'banned@test.com',
    password: 'TestPassword123!',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    isBanned: true,
  },
  noBalanceUser: {
    id: randomUUID(),
    username: 'newplayer',
    email: 'newplayer@test.com',
    password: 'TestPassword123!',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    balance: {},
  },
};

// Test Transactions
export const testTransactions = {
  deposit1: {
    id: randomUUID(),
    userId: testUsers.player1.id,
    fireblocksId: 'fb-deposit-1',
    asset: AssetTypeEnum.BTC,
    amount: '0.05000000',
    type: 'deposit',
    status: 'completed',
    txHash: '0x123456789',
    fee: '0.00010000',
  },
  withdrawal1: {
    id: randomUUID(),
    userId: testUsers.player1.id,
    fireblocksId: 'fb-withdraw-1',
    asset: AssetTypeEnum.USDT,
    amount: '100.00000000',
    type: 'withdrawal',
    status: 'pending',
    address: 'TRX123456789',
  },
};

// Test Game Data
export const testGames = {
  diceGame1: {
    id: randomUUID(),
    userId: testUsers.player1.id,
    betAmount: '10.00000000',
    asset: AssetTypeEnum.USDT,
    rollOver: true,
    target: 50,
    result: 65.32,
    payout: '19.60000000',
    won: true,
    serverSeed: 'server-seed-1',
    clientSeed: 'client-seed-1',
    nonce: 1,
  },
  crashGame1: {
    id: randomUUID(),
    serverSeed: 'crash-server-seed-1',
    crashPoint: 2.45,
    status: 'completed',
    bets: [
      {
        userId: testUsers.player1.id,
        amount: '50.00000000',
        asset: AssetTypeEnum.USDT,
        cashOutAt: 2.0,
        won: true,
        payout: '100.00000000',
      },
      {
        userId: testUsers.player2.id,
        amount: '25.00000000',
        asset: AssetTypeEnum.USDT,
        cashOutAt: null, // Didn't cash out
        won: false,
        payout: '0',
      },
    ],
  },
};

// Test Balance Operations
export const testBalanceOperations = {
  operations: [
    {
      operationId: randomUUID(),
      userId: testUsers.player1.id,
      operation: BalanceOperationEnum.DEPOSIT,
      amount: '100.00000000',
      asset: AssetTypeEnum.USDT,
      description: 'Test deposit',
    },
    {
      operationId: randomUUID(),
      userId: testUsers.player1.id,
      operation: BalanceOperationEnum.BET,
      amount: '10.00000000',
      asset: AssetTypeEnum.USDT,
      description: 'Dice game bet',
    },
    {
      operationId: randomUUID(),
      userId: testUsers.player1.id,
      operation: BalanceOperationEnum.WIN,
      amount: '19.60000000',
      asset: AssetTypeEnum.USDT,
      description: 'Dice game win',
    },
  ],
};

// Factory Functions
export function createTestUser(overrides: Partial<typeof testUsers.player1> = {}) {
  return {
    id: randomUUID(),
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    registrationStrategy: AuthStrategyEnum.EMAIL,
    balance: {},
    ...overrides,
  };
}

export function createTestTransaction(
  userId: string,
  overrides: Partial<typeof testTransactions.deposit1> = {},
) {
  return {
    id: randomUUID(),
    userId,
    fireblocksId: `fb-${Date.now()}`,
    asset: AssetTypeEnum.USDT,
    amount: '100.00000000',
    type: 'deposit',
    status: 'completed',
    ...overrides,
  };
}

export function createTestGameSession(userId: string, gameType: string) {
  return {
    id: randomUUID(),
    userId,
    gameType,
    clientSeed: 'test-client-seed',
    serverSeed: 'test-server-seed',
    nonce: 0,
    isActive: true,
    createdAt: new Date(),
  };
}

// Helper to reset test data sequences
let nonceCounter = 0;
export function resetTestDataSequences() {
  nonceCounter = 0;
}

export function getNextNonce() {
  return ++nonceCounter;
}

// Test JWT Tokens
export const testTokens = {
  validAccessToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  expiredAccessToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiZXhwIjoxNTE2MjM5MDIyfQ.4Adcj3UFYzPUVaVF43FmMab6RlaQD8A9V8wFzzht-KQ',
  validRefreshToken:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJ0eXBlIjoicmVmcmVzaCJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
};

// WebSocket Test Events
export const testWebSocketEvents = {
  joinGame: {
    event: 'join-game',
    data: {
      gameType: 'crash',
      roomId: 'crash-main',
    },
  },
  placeBet: {
    event: 'place-bet',
    data: {
      gameId: testGames.crashGame1.id,
      amount: '50.00000000',
      asset: AssetTypeEnum.USDT,
    },
  },
  cashOut: {
    event: 'cash-out',
    data: {
      gameId: testGames.crashGame1.id,
    },
  },
};
