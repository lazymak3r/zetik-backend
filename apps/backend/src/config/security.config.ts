import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  twoFactor: {
    codeLength: 6,
    tokenTtlSeconds: 180,
    usedTokenPrefix: '2fa-used:',
    rateLimitMaxAttempts: 5,
    rateLimitWindowSeconds: 900,
    rateLimitPrefix: '2fa-attempts:',
  },
  pendingAuth: {
    tokenTtlSeconds: 300,
    maxAttempts: 10,
    rateLimitWindowSeconds: 900,
    rateLimitPrefix: 'pending-auth-rate:',
    tokenPrefix: 'pending-auth:',
  },
}));
