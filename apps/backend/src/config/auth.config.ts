import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const authConfig = registerAs(
  'auth',
  () =>
    ({
      secret: env.get('JWT_SECRET').required().asString(),
      accessExpiration: env.get('JWT_ACCESS_EXPIRATION').required().asString(),
      refreshSecret: env.get('JWT_REFRESH_SECRET').required().asString(),
      refreshExpiration: env.get('JWT_REFRESH_EXPIRATION').required().asString(),
      googleClientId: env.get('GOOGLE_CLIENT_ID').required().asString(),
      googleClientSecret: env.get('GOOGLE_CLIENT_SECRET').required().asString(),
      steamApiKey: env.get('STEAM_API_KEY').required().asString(),
      steamRealm: env.get('STEAM_REALM').required().asString(),
    }) as const,
);
