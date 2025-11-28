import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const securityConfig = registerAs('security', () => ({
  bcryptRounds: env.get('ADMIN_BCRYPT_ROUNDS').required().asIntPositive(),
  maxLoginAttempts: env.get('ADMIN_MAX_LOGIN_ATTEMPTS').required().asIntPositive(),
  loginLockoutDuration: env.get('ADMIN_LOGIN_LOCKOUT_DURATION').required().asIntPositive(),
  sessionSecret: env.get('ADMIN_SESSION_SECRET').required().asString(),
  sessionExpiration: env.get('ADMIN_SESSION_EXPIRATION').required().asIntPositive(),
  rateLimit: {
    ttl: env.get('ADMIN_RATE_LIMIT_TTL').required().asIntPositive(),
    limit: env.get('ADMIN_RATE_LIMIT_LIMIT').required().asIntPositive(),
  },
}));
