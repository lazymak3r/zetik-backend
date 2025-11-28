import { config } from 'dotenv';
import { resolve } from 'path';

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
