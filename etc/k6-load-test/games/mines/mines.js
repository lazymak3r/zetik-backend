import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { login } from '../../auth.js';
import { config } from '../../config.js';

// Simple UUID v4 generator for k6
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const gameWins = new Counter('game_wins');
const gameLosses = new Counter('game_losses');
const totalBets = new Counter('total_bet_amount');
const totalPayouts = new Counter('total_payout_amount');

let authData = null;

export function setupMines(testType) {
  console.log(`Starting MINES AUTOPLAY ${testType} test`);
  authData = login();
  return authData;
}

export function playMines(data, testType) {
  // If setup failed (server health check or login), don't run tests
  if (data === null) {
    console.log('Skipping iteration - setup failed');
    return;
  }

  if (!authData) {
    authData = data || login();
  }

  // VU-specific delay - МИНИМАЛЬНЫЙ для house edge расчета
  const vuOffset = testType === 'smoke' ? 0 : (__VU - 1) * 0.1; // 0.1s spread - БЫСТРО!
  if (vuOffset > 0) {
    sleep(vuOffset);
    if (testType === 'load') {
      console.log(`VU ${__VU} started after ${vuOffset}s offset (FAST house edge mode)`);
    }
  }

  const betAmount = parseFloat(
    (testType === 'smoke'
      ? config.betting.minBet
      : Math.random() * (config.betting.maxBet - config.betting.minBet) + config.betting.minBet
    ).toFixed(8),
  ); // Ensure max 8 decimal places

  const minesCount =
    config.mines.mineMounts[Math.floor(Math.random() * config.mines.mineMounts.length)]; // Random from predefined counts

  // AUTOPLAY - entire game in one atomic request!
  // Fixed tile positions for reproducible testing and comparison
  const predefinedTiles = [0, 1, 2]; // Always reveal same tiles for comparison
  const gameSessionId = generateUUID();

  if (testType === 'smoke') {
    console.log(
      `VU ${__VU}: Starting AUTOPLAY game with bet ${betAmount}, mines ${minesCount}, tiles [${predefinedTiles.join(',')}]`,
    );
  }

  // Проверяем активную игру ПЕРЕД autoplay
  const activeGameResponse = http.get(`${config.domain}/v1/games/mines/active`, {
    headers: {
      Authorization: `Bearer ${authData.token}`,
    },
  });

  // Если есть активная игра - завершаем ее правильно
  if (activeGameResponse.status === 200) {
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Active game found, completing it first...`);
    }

    try {
      const activeGame = activeGameResponse.json();
      if (activeGame && activeGame.id) {
        // СНАЧАЛА открываем тайл, ПОТОМ cashout
        const revealResponse = http.post(
          `${config.domain}/v1/games/mines/reveal`,
          JSON.stringify({
            gameId: activeGame.id,
            tilePosition: 24, // Последний тайл - безопасный для cleanup
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.token}`,
            },
          },
        );

        // Если не попали в мину - делаем cashout
        if (revealResponse.status === 200 || revealResponse.status === 201) {
          const cashoutResponse = http.post(
            `${config.domain}/v1/games/mines/cashout`,
            JSON.stringify({ gameId: activeGame.id }),
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authData.token}`,
              },
            },
          );

          if (
            testType === 'smoke' &&
            cashoutResponse.status !== 200 &&
            cashoutResponse.status !== 201 &&
            cashoutResponse.status !== 400
          ) {
            console.log(`VU ${__VU}: Cashout response: ${cashoutResponse.status}`);
          }
        }
        // Если попали в мину - игра автоматически завершена
      }
    } catch (e) {
      if (testType === 'smoke') {
        console.log(`VU ${__VU}: Active game cleanup error: ${e.message}`);
      }
    }
  }

  const autoplayResponse = http.post(
    `${config.domain}/v1/games/mines/autoplay`,
    JSON.stringify({
      betAmount: betAmount,
      minesCount: minesCount,
      tilePositions: predefinedTiles, // Fixed positions for reproducible results!
      gameSessionId: gameSessionId,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.token}`,
      },
    },
  );

  if (autoplayResponse.status === 401) {
    console.log('Token expired, re-authenticating...');
    authData = login();
    if (!authData) return;
    return; // Skip this iteration, retry next time
  }

  // Handle active game errors with minimal delay
  if (
    autoplayResponse.status === 400 &&
    autoplayResponse.body &&
    autoplayResponse.body.includes('already have an active')
  ) {
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Active game exists, minimal wait...`);
    }

    // Backoff для активной игры - МИНИМАЛЬНЫЙ для house edge
    const backoffDelay = testType === 'smoke' ? 0 : Math.random() * 0.3 + 0.2 + __VU * 0.05; // 0.2-0.5s БЫСТРО!
    if (backoffDelay > 0) {
      sleep(backoffDelay);
    }
    return;
  }

  // Rate limiting
  if (autoplayResponse.status === 429) {
    if (testType === 'smoke') {
      console.log('Rate limit hit on autoplay, short wait...');
    }
    const rateLimitDelay = testType === 'smoke' ? 0 : Math.random() * 0.5 + 0.5; // 0.5-1s БЫСТРО при rate limit!
    if (rateLimitDelay > 0) {
      sleep(rateLimitDelay);
    }
    return;
  }

  const gameSuccess = check(autoplayResponse, {
    'game started successfully': (r) => r.status === 201,
    'valid game response format': (r) => {
      try {
        const result = r.json();
        return result && typeof result.status === 'string';
      } catch {
        return false;
      }
    },
    'correct mines count': (r) => {
      try {
        const result = r.json();
        return result && result.minesCount === minesCount;
      } catch {
        return false;
      }
    },
  });

  if (!gameSuccess) {
    console.log(`Autoplay failed: ${autoplayResponse.status} ${autoplayResponse.body}`);
    return;
  }

  const finalResult = autoplayResponse.json();

  // Track metrics
  const betAmt = parseFloat(finalResult.betAmount || betAmount);
  const winAmt = parseFloat(finalResult.finalPayout || 0);

  totalBets.add(betAmt);
  totalPayouts.add(winAmt);

  if (testType === 'smoke') {
    console.log(
      `AUTOPLAY result: ${finalResult.status}, bet: ${betAmt}, payout: ${winAmt}, multiplier: ${finalResult.currentMultiplier || '0.00'}`,
    );
  }

  if (finalResult.status === 'COMPLETED') {
    gameWins.add(1);
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: AUTOPLAY Game WON ✅ (tiles: [${predefinedTiles.join(',')}])`);
    }
  } else {
    gameLosses.add(1);
    if (testType === 'smoke') {
      console.log(
        `VU ${__VU}: AUTOPLAY Game LOST ❌ (hit mine on tiles: [${predefinedTiles.join(',')}])`,
      );
    }
  }

  // Final delay - МИНИМАЛЬНЫЙ для house edge расчета!
  const finalDelay = testType === 'smoke' ? 0 : Math.random() * 0.1 + 0.05; // 0.05-0.15s МАКСИМАЛЬНАЯ СКОРОСТЬ!
  if (finalDelay > 0) {
    sleep(finalDelay);
  }
}
