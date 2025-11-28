import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const defaultAdminConfig = registerAs('defaultAdmin', () => ({
  email: env.get('DEFAULT_ADMIN_EMAIL').required().asEmailString(),
  password: env.get('DEFAULT_ADMIN_PASSWORD').required().asString(),
  name: env.get('DEFAULT_ADMIN_NAME').required().asString(),
}));
