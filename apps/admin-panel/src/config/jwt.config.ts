import { registerAs } from '@nestjs/config';
import { JwtModuleOptions } from '@nestjs/jwt';
import * as env from 'env-var';

export default registerAs(
  'jwt',
  (): JwtModuleOptions => ({
    secret: env.get('ADMIN_JWT_SECRET').required().asString(),
    signOptions: {
      expiresIn: env.get('ADMIN_JWT_ACCESS_EXPIRATION').required().asString(),
    },
  }),
);
