import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const databaseConfig = registerAs('database', () => ({
  host: env.get('DB_HOST').required().asString(),
  port: env.get('DB_PORT').required().asPortNumber(),
  username: env.get('DB_USERNAME').required().asString(),
  password: env.get('DB_PASSWORD').required().asString(),
  database: env.get('DB_DATABASE').required().asString(),
  schemas: {
    users: env.get('DB_USERS_SCHEMA').default('users').asString(),
    payments: env.get('DB_PAYMENTS_SCHEMA').default('payments').asString(),
    balance: env.get('DB_BALANCE_SCHEMA').default('balance').asString(),
    games: env.get('DB_GAMES_SCHEMA').default('games').asString(),
    bonus: env.get('DB_BONUS_SCHEMA').default('bonus').asString(),
    blog: env.get('DB_BLOG_SCHEMA').default('blog').asString(),
    chat: env.get('DB_CHAT_SCHEMA').default('chat').asString(),
    affiliate: env.get('DB_AFFILIATE_SCHEMA').default('affiliate').asString(),
  },
}));
