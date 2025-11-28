import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const commonConfig = registerAs('common', () => ({
  isProduction: process.env.NODE_ENV === 'production',
  nodeEnv:
    process.env.NODE_ENV === 'test'
      ? 'development'
      : env.get('NODE_ENV').default('development').asEnum(['development', 'production', 'test']),
  port: env.get('ADMIN_PORT').required().asPortNumber(),
  corsOrigins: env
    .get('ADMIN_CORS_ORIGINS')
    .required()
    .asArray(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  backendUrl: env.get('BACKEND_URL').required().asString(),
  adminApiSecret: env.get('ADMIN_API_SECRET').required().asString(),
}));
