import { registerAs } from '@nestjs/config';
import * as env from 'env-var';
import { commonConfig } from './common.config';

export const mailConfig = registerAs(
  'mail',
  () =>
    ({
      mailgunApiKey: env.get('MAILGUN_API_KEY').required().asString(),
      mailgunDomain: env.get('MAILGUN_DOMAIN').required().asString(),
      mailgunFrom: env
        .get('MAILGUN_FROM')
        .default(`no-reply@${env.get('MAILGUN_DOMAIN').required().asString()}`)
        .asString(),
      mailgunBaseUrl: env.get('MAILGUN_BASE_URL').default('https://api.mailgun.net').asString(),
      frontendUrl: commonConfig().frontendUrl,
      emailVerificationExpiration: env
        .get('EMAIL_VERIFICATION_EXPIRATION')
        .required()
        .asIntPositive(),
      passwordResetExpiration: 900,
    }) as const,
);
