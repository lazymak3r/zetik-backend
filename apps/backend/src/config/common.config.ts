import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const commonConfig = registerAs(
  'common',
  () =>
    ({
      isProduction: process.env.NODE_ENV === 'production',
      isTest: process.env.NODE_ENV === 'test',
      nodeEnv:
        process.env.NODE_ENV === 'test'
          ? 'development'
          : env.get('NODE_ENV').required().asEnum(['development', 'production']),
      port: env.get('PORT').required().asPortNumber(),
      corsOrigins: env
        .get('CORS_ORIGINS')
        .required()
        .asArray(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
      frontendUrl: env.get('FRONTEND_URL').required().asUrlString(),
      // Admin API configuration
      adminApiSecret: env.get('ADMIN_API_SECRET').required().asString(),
      adminAllowedIps: env
        .get('ADMIN_ALLOWED_IPS')
        .required()
        .asArray(',')
        .map((ip) => ip.trim())
        .filter((ip) => ip.length > 0),
      // Logging configuration (production only)
      logging: {
        simpleFormat: env.get('LOG_SIMPLE_FORMAT').default('true').asBool(),
        requestLogging: env.get('LOG_REQUESTS').default('false').asBool(),
        maxLength: env.get('LOG_MAX_LENGTH').default('1000').asIntPositive(),
      },
    }) as const,
);
