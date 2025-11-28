/* global __ENV */

export const config = {
  // Test users with funded accounts
  users: [
    {
      login: __ENV.TEST_USER_EMAIL || 'test@example.com',
      password: __ENV.TEST_USER_PASSWORD || 'TestPassword123',
    },
  ],

  // Available games for testing
  games: ['DICE', 'MINES'],
  currentGame: __ENV.GAME || 'DICE',

  // Environment settings
  domain: __ENV.GAME_DOMAIN || 'http://localhost:3000',

  // Common betting settings for all games
  betting: {
    minBet: 0.001, // Увеличено для Mines autoplay precision requirements
    maxBet: 0.001, // Фиксированная ставка для стабильного house edge
    delayMs: 1000,
  },

  // Standard load testing options (exactly 1 minute)
  loadOptions: {
    stages: [
      { duration: '20s', target: 5 },
      { duration: '20s', target: 5 },
      { duration: '20s', target: 0 },
    ],
    thresholds: {
      http_req_duration: ['p(95)<2000'],
      http_req_failed: ['rate<0.001'],
    },
  },

  // Smoke test options (quick verification - 1-2 bets in 1-2 seconds!)
  smokeOptions: {
    executor: 'shared-iterations',
    vus: 1,
    iterations: 2, // ТОЛЬКО 2 ставки максимум!
    maxDuration: '2s', // БЫСТРО: 1-2 секунды!
    thresholds: {
      http_req_duration: ['p(95)<1000'], // Быстрые запросы
      http_req_failed: ['rate<0.5'], // Более мягкий порог для 2 ставок
    },
  },

  // DICE game specific settings
  dice: {
    targets: [25.0, 35.0, 45.0, 50.0, 55.0, 65.0, 75.0],
  },

  // MINES game specific settings
  mines: {
    mineMounts: [1, 3, 5, 8, 10], // Different risk levels
    maxTileReveals: 3, // Maximum tiles to reveal per game
  },
};
