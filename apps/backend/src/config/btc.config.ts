import { registerAs } from '@nestjs/config';

export const btcConfig = registerAs('btc', () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    // For production: mainnet addresses (bc1, 1, 3)
    // For development/test: testnet addresses (tb1, 2, m, n)
    allowedPrefixes: isProduction ? ['bc1', '1', '3'] : ['tb1', '2', 'm', 'n'],
    addressRegex: isProduction
      ? /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/
      : /^(tb1|[2mn])[a-zA-HJ-NP-Z0-9]{25,62}$/,
    exampleAddress: isProduction
      ? 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      : 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  } as const;
});
