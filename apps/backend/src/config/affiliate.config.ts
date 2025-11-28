import { registerAs } from '@nestjs/config';
import { commonConfig } from './common.config';

export const affiliateConfig = registerAs(
  'affiliate',
  () =>
    ({
      commission: 0.1, // 10% commission
      frontendUrl: commonConfig().frontendUrl,
    }) as const,
);
