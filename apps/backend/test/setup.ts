import { config } from 'dotenv';
import { resolve } from 'path';
import 'reflect-metadata';

// Mock path-scurry to prevent Node.js v24 compatibility issue
// This must be done before any module that imports typeorm
jest.mock('path-scurry', () => {
  // Use jest.requireActual to get the actual path module (hoisting-safe)
  const pathModule = jest.requireActual<typeof import('path')>('path');

  // Minimal PathScurry implementation for tests
  class PathScurry {
    private _cwd: string;

    constructor(cwd?: string) {
      this._cwd = cwd || process.cwd();
    }

    resolve(...paths: string[]): string {
      return pathModule.resolve(this._cwd, ...paths);
    }
  }

  return {
    PathScurry,
    Path: class Path {},
  };
});

// Load environment variables from backend .env file
config({ quiet: true, path: resolve(__dirname, '../.env.test') });

// Mock external services for testing
jest.mock('node-fetch', () => {
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          bitcoin: { usd: 50000 },
          litecoin: { usd: 100 },
          dogecoin: { usd: 0.25 },
          ethereum: { usd: 3000 },
          'usd-coin': { usd: 1 },
          tether: { usd: 1 },
          ripple: { usd: 0.5 },
          solana: { usd: 100 },
          tron: { usd: 0.1 },
        }),
    }),
  );
});

// Mock SelfExclusionService for all unit tests
jest.mock('../src/users/self-exclusion.service', () => ({
  SelfExclusionService: jest.fn().mockImplementation(() => ({
    getActiveSelfExclusions: jest.fn().mockResolvedValue([]),
    hasActiveSelfExclusion: jest.fn().mockResolvedValue(false),
    formatRemainingTime: jest.fn(),
  })),
}));

// Mock BalanceService to avoid BetSourceEnum issue
jest.mock('../src/balance/balance.service', () => ({
  BalanceService: jest.fn().mockImplementation(() => ({
    updateBalance: jest.fn().mockResolvedValue({
      success: true,
      balance: '100',
      status: 'SUCCESS',
    }),
  })),
}));

// Mock AffiliateService to avoid AffiliateEarningsEntity issue
jest.mock('../src/affiliate/affiliate.service', () => ({
  AffiliateService: jest.fn().mockImplementation(() => ({
    // Add minimal implementation
  })),
}));

// Stub FiatFormatEnum to prevent undefined errors in shared entities
jest.mock('@zetik/common', () => {
  const actual = jest.requireActual('@zetik/common');
  return {
    ...actual,
    FiatFormatEnum: {
      STANDARD: 'STANDARD',
      COMPACT: 'COMPACT',
    },
  };
});

// SINGLE COMPREHENSIVE MOCK for shared entities - REPLACES the duplicate
jest.mock('@zetik/shared-entities', () => {
  const originalModule = jest.requireActual('@zetik/shared-entities');

  // Helper to create empty classes/functions for missing exports
  const createFallback = (name: string) => {
    if (name.endsWith('Entity')) return class {};
    if (name.endsWith('Enum')) return {};
    if (name.endsWith('Dto')) return class {};
    return {};
  };

  return new Proxy(originalModule, {
    get: (target, prop: string) => {
      if (prop in target) {
        return target[prop];
      }
      console.warn(`[@zetik/shared-entities] Missing export: ${prop}, providing fallback`);
      return createFallback(prop);
    },
  });
});
