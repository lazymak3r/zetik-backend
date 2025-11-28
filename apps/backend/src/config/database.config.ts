import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const databaseConfig = registerAs(
  'database',
  () =>
    ({
      host: env.get('DB_HOST').required().asString(),
      port: env.get('DB_PORT').required().asPortNumber(),
      username: env.get('DB_USERNAME').required().asString(),
      password: env.get('DB_PASSWORD').required().asString(),
      database: env.get('DB_DATABASE').required().asString(),
    }) as const,
);
