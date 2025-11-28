import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const sportsbookConfig = registerAs(
  'sportsbook',
  () =>
    ({
      betby: {
        publicKey: env.get('BETBY_PUBLIC_KEY').required().asString(),
        operatorId: env.get('BETBY_OPERATOR_ID').required().asString(),
        brandId: env.get('BETBY_BRAND_ID').required().asString(),
        externalApiUrl: env.get('BETBY_EXTERNAL_API_URL').required().asString(),
        themeName: env.get('BETBY_THEME_NAME').required().asString(),
        localPrivateKey: env.get('BETBY_LOCAL_PRIVATE_KEY').required().asString(),
      },
    }) as const,
);
