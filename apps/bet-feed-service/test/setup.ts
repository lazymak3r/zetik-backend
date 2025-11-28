import { config } from 'dotenv';
import { resolve } from 'path';
import 'reflect-metadata';

// Load environment variables from backend .env file
config({ quiet: true, path: resolve(__dirname, '../../backend/.env.test') });

// Mock glob to avoid path-scurry issues with TypeORM in tests
jest.mock('glob', () => ({
  glob: jest.fn().mockResolvedValue([]),
  globSync: jest.fn().mockReturnValue([]),
  Glob: jest.fn(),
}));

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
jest.mock('../../backend/src/users/self-exclusion.service', () => ({
  SelfExclusionService: jest.fn().mockImplementation(() => ({
    getActiveSelfExclusions: jest.fn().mockResolvedValue([]),
    hasActiveSelfExclusion: jest.fn().mockResolvedValue(false),
    formatRemainingTime: jest.fn(),
  })),
}));

// Stub FiatFormatEnum to prevent undefined errors in shared entities
// Don't mock the entire module - just provide the missing enum
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
