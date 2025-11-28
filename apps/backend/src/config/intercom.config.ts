import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const intercomConfig = registerAs(
  'intercom',
  () =>
    ({
      accessToken: env.get('INTERCOM_ACCESS_TOKEN').required().asString(),
      webSecret: env.get('INTERCOM_WEB_SECRET').required().asString(),
    }) as const,
);
