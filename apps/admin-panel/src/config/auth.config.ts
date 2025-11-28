import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const authConfig = registerAs('auth', () => ({
  secret: env.get('ADMIN_JWT_SECRET').required().asString(),
  accessExpiration: env.get('ADMIN_JWT_ACCESS_EXPIRATION').required().asString(),
  refreshSecret: env.get('ADMIN_JWT_REFRESH_SECRET').required().asString(),
  refreshExpiration: env.get('ADMIN_JWT_REFRESH_EXPIRATION').required().asString(),
}));
