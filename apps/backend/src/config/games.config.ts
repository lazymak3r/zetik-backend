import { registerAs } from '@nestjs/config';
import * as env from 'env-var';

export const gamesConfig = registerAs(
  'games',
  () =>
    ({
      houseEdge: {
        // RNG games - configurable house edge
        // NOTE: These are not used. Limits are determined dynamically in database.
        crash: env.get('GAME_HOUSE_EDGE_CRASH').default('1.0').asString(),
        mines: env.get('GAME_HOUSE_EDGE_MINES').default('1.0').asString(),
        plinko: env.get('GAME_HOUSE_EDGE_PLINKO').default('2.0').asString(),
        limbo: env.get('GAME_HOUSE_EDGE_LIMBO').default('2.0').asString(),
        keno: env.get('GAME_HOUSE_EDGE_KENO').default('5.0').asString(),
        // Note: Blackjack (~0.52%) and Roulette (~2.70%) use fixed mathematical house edge
      },
      defaultHouseEdge: parseFloat(process.env.GAME_DEFAULT_HOUSE_EDGE || '2.0'),
      maxMultiplier: {
        limbo: parseFloat(process.env.GAME_MAX_MULTIPLIER_LIMBO || '1000000'),
        crash: 1000000, // Hard maximum for practical purposes, no env var needed
      },
      crash: {
        bettingTime: env.get('GAME_CRASH_BETTING_TIME').default(5000).asIntPositive(),
        // Removed minCrashPoint and maxCrashPoint - house edge comes from instant crashes
      },
    }) as const,
);
