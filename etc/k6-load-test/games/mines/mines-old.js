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
  console.log(`Starting MINES ${testType} test`);
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

  // Add VU-specific delay to reduce race conditions with single user
  // Each VU gets different offset to spread load across time
  const vuOffset = (__VU - 1) * 0.5; // 0.5s spread between VUs (faster performance)
  if (testType === 'load' && vuOffset > 0) {
    sleep(vuOffset);
    if (testType === 'smoke') {
      console.log(`VU ${__VU} started after ${vuOffset}s offset`);
    }
  }

  // First, check if there's an active game and finish it
  const activeGameResponse = http.get(`${config.domain}/v1/games/mines/active`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authData.token}`,
    },
  });

  // If there's an active game, finish it properly (reveal + cashout OR auto-finish if hit mine)
  if (activeGameResponse.status === 200 && activeGameResponse.body) {
    let activeGame;
    try {
      activeGame = activeGameResponse.json();
    } catch (e) {
      // No valid JSON response - probably no active game
      activeGame = null;
    }

    if (activeGame && activeGame.id) {
      if (testType === 'smoke') {
        console.log('Found active game, finishing it before starting new game');
      }

      // First reveal 1-2 predetermined tiles to make cashout possible
      const cleanupTiles = [3, 7]; // Fixed cleanup tiles
      const tilesToReveal = Math.min(2, cleanupTiles.length);
      let gameFinished = false;

      for (let i = 0; i < tilesToReveal && !gameFinished; i++) {
        // Use predetermined tile position for consistent cleanup
        const tilePosition = cleanupTiles[i];

        const revealResponse = http.post(
          `${config.domain}/v1/games/mines/reveal`,
          JSON.stringify({
            gameId: activeGame.id,
            tilePosition: tilePosition,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.token}`,
            },
          },
        );

        if (revealResponse.status === 200 || revealResponse.status === 201) {
          const revealResult = revealResponse.json();
          if (testType === 'smoke') {
            console.log(
              `Reveal successful at position ${tilePosition}, status: ${revealResult.status}`,
            );
          }
          if (revealResult.status === 'BUSTED' || revealResult.status === 'COMPLETED') {
            // Game automatically finished - no need for cashout
            gameFinished = true;
            if (testType === 'smoke') {
              console.log(`Game auto-finished with status: ${revealResult.status}`);
            }
          }
        } else if (revealResponse.status === 429) {
          // Rate limit hit - stop processing and wait
          if (testType === 'smoke') {
            console.log(`Rate limit hit during active game cleanup, waiting...`);
          }
          sleep(Math.random() * 1 + 1); // 1-2s wait for rate limit
          return;
        } else if (
          revealResponse.status === 400 &&
          revealResponse.body &&
          revealResponse.body.includes('Game is not active')
        ) {
          // Game already finished (BUSTED/COMPLETED) - this is normal in load testing
          if (testType === 'smoke') {
            console.log(`Game already finished during cleanup - this is expected`);
          }
          return; // Exit cleanup since game is already done
        } else {
          if (testType === 'smoke') {
            console.log(
              `Reveal API failed at position ${tilePosition}: ${revealResponse.status} ${revealResponse.body}`,
            );
          }
        }
      }

      // If game is still active after reveals, cashout
      if (!gameFinished) {
        const cashoutResponse = http.post(
          `${config.domain}/v1/games/mines/cashout`,
          JSON.stringify({
            gameId: activeGame.id,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authData.token}`,
            },
          },
        );

        if (cashoutResponse.status === 200 || cashoutResponse.status === 201) {
          if (testType === 'smoke') {
            console.log('Successfully cashed out previous game');
          }
        } else if (
          cashoutResponse.status === 400 &&
          cashoutResponse.body &&
          cashoutResponse.body.includes('Game is not active')
        ) {
          // Game already finished - this is normal for load testing
          if (testType === 'smoke') {
            console.log(`VU ${__VU}: Active game already finished - no cashout needed`);
          }
        } else if (testType === 'smoke') {
          console.log(
            `VU ${__VU}: Cashout failed: ${cashoutResponse.status} ${cashoutResponse.body}`,
          );
        }
      }

      // Small delay to ensure game is fully processed
      sleep(0.2);
    }
  }

  const betAmount =
    testType === 'smoke'
      ? config.betting.minBet
      : Math.random() * (config.betting.maxBet - config.betting.minBet) + config.betting.minBet;

  // Fixed parameters for consistent analysis
  const minesCount = 3; // Medium risk for consistent analysis

  if (testType === 'smoke') {
    console.log(`Making MINES bet: ${betAmount} with ${minesCount} mines`);
  }

  // Step 1: Start mines game
  const gameSessionId = generateUUID();
  const gameResponse = http.post(
    `${config.domain}/v1/games/mines/start`,
    JSON.stringify({
      betAmount: betAmount.toFixed(8),
      minesCount: minesCount,
      gameSessionId: gameSessionId,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.token}`,
      },
    },
  );

  if (gameResponse.status === 401) {
    console.log('Token expired, re-authenticating...');
    authData = login();
    if (!authData) return;
    return; // Skip this iteration, retry next time
  }

  // Check if there's already an active game - this is OK for load testing
  if (
    gameResponse.status === 400 &&
    gameResponse.body &&
    gameResponse.body.includes('already have an active')
  ) {
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Active game exists, waiting for completion...`);
    }

    // For load testing with multiple VUs - fast backoff
    const backoffDelay = Math.random() * 1 + 0.5 + __VU * 0.2; // 0.5-1.5s + VU-specific offset
    sleep(backoffDelay);
    return;
  }

  const gameStartSuccess = check(gameResponse, {
    'game started successfully': (r) => r.status === 201,
    'valid game response format': (r) => r.json('id') !== undefined,
    'correct mines count': (r) => r.json('minesCount') === minesCount,
  });

  if (!gameStartSuccess || gameResponse.status !== 201) {
    if (testType === 'smoke') {
      console.error(`Game start failed: ${gameResponse.status} ${gameResponse.body}`);
    }
    sleep(testType === 'smoke' ? 1 : config.betting.delayMs / 1000);
    return;
  }

  const gameData = gameResponse.json();
  const gameId = gameData.id;

  // Step 2: Reveal fixed tiles for reproducible testing
  // Using predetermined tile positions for consistent testing and comparison
  const predefinedTiles = [0, 1, 2, 5, 10, 15, 20]; // Safe tiles for testing
  const tilesToReveal = Math.min(2, predefinedTiles.length); // Max 2 tiles
  let currentGame = gameData;
  let finalResult = gameData; // Declare finalResult early

  for (let i = 0; i < tilesToReveal; i++) {
    // Use predetermined tile position for reproducible results
    const tilePosition = predefinedTiles[i];

    // Skip if already revealed
    if (currentGame.revealedTiles && currentGame.revealedTiles.includes(tilePosition)) {
      if (testType === 'smoke') {
        console.log(`Tile ${tilePosition} already revealed, skipping`);
      }
      continue;
    }

    const revealResponse = http.post(
      `${config.domain}/v1/games/mines/reveal`,
      JSON.stringify({
        gameId: gameId,
        tilePosition: tilePosition,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authData.token}`,
        },
      },
    );

    if (revealResponse.status === 200 || revealResponse.status === 201) {
      currentGame = revealResponse.json();

      if (testType === 'smoke') {
        console.log(
          `VU ${__VU}: Reveal successful at position ${tilePosition}, status: ${currentGame.status}`,
        );
      }

      // If game is completed (BUSTED or COMPLETED), break - no need for cashout
      if (currentGame.status === 'BUSTED' || currentGame.status === 'COMPLETED') {
        if (testType === 'smoke') {
          console.log(
            `VU ${__VU}: Game auto-finished with status: ${currentGame.status} - no cashout needed`,
          );
        }
        finalResult = currentGame; // Update finalResult immediately
        break;
      }
    } else if (revealResponse.status === 429) {
      // Rate limit hit - wait and skip this game
      if (testType === 'smoke') {
        console.log(`Rate limit hit on reveal, waiting...`);
      }
      sleep(Math.random() * 0.5 + 0.5); // Wait 0.5-1s (faster)
      break;
    } else if (
      revealResponse.status === 400 &&
      revealResponse.body &&
      revealResponse.body.includes('Game is not active')
    ) {
      // Game finished during our reveals (hit mine or completed) - this is normal
      if (testType === 'smoke') {
        console.log(`Game finished during reveals - checking final status`);
      }

      // Try to get final game state
      const finalGameResponse = http.get(`${config.domain}/v1/games/mines/active`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authData.token}` },
      });

      if (finalGameResponse.status === 404 || !finalGameResponse.body) {
        // No active game - it's finished, break with current game state
        break;
      }
    } else {
      if (testType === 'smoke') {
        console.log(
          `Reveal API failed at position ${tilePosition}: ${revealResponse.status} ${revealResponse.body}`,
        );
      }

      // For other errors, skip this game
      break;
    }

    // Delay between reveals - optimized for performance
    const delayTime = testType === 'smoke' ? 0.1 : Math.random() * 0.3 + 0.2; // 0.2-0.5s for load (faster)
    sleep(delayTime);
  }

  // Step 3: ALWAYS ensure game is completed - cashout if still active
  finalResult = currentGame; // Update finalResult with current state

  // Additional safety check - verify game is still active before cashout
  if (currentGame.status === 'ACTIVE' && currentGame.id === gameId) {
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Attempting cashout for game ${gameId}`);
    }
    const cashoutResponse = http.post(
      `${config.domain}/v1/games/mines/cashout`,
      JSON.stringify({
        gameId: gameId,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authData.token}`,
        },
      },
    );

    if (cashoutResponse.status === 200 || cashoutResponse.status === 201) {
      finalResult = cashoutResponse.json();
      if (testType === 'smoke') {
        console.log(`VU ${__VU}: Successfully cashed out game ${gameId}`);
      }
    } else if (cashoutResponse.status === 429) {
      // Rate limit hit on cashout
      if (testType === 'smoke') {
        console.log('Rate limit hit on cashout, waiting...');
      }
      sleep(Math.random() * 0.5 + 0.5); // Wait 0.5-1s (faster)
      return; // Skip this iteration
    } else if (
      cashoutResponse.status === 400 &&
      cashoutResponse.body &&
      cashoutResponse.body.includes('Cannot cash out without revealing any tiles')
    ) {
      // This can happen due to race conditions in load testing
      if (testType === 'smoke') {
        console.log(`VU ${__VU}: Cannot cashout - no tiles revealed (race condition)`);
      }
      // Use current game state as final result
      finalResult = currentGame;
    } else if (
      cashoutResponse.status === 400 &&
      cashoutResponse.body &&
      cashoutResponse.body.includes('Game is not active')
    ) {
      // Game already finished (BUSTED or already cashed out) - this is normal in load testing
      if (testType === 'smoke') {
        console.log(`VU ${__VU}: Game ${gameId} already finished - no cashout needed (expected)`);
      }
      // Use current game state as final result
      finalResult = currentGame;
    } else {
      if (testType === 'smoke') {
        console.log(
          `VU ${__VU}: Cashout failed: ${cashoutResponse.status} ${cashoutResponse.body}`,
        );
      }
      // Use current game state as final result even on error
      finalResult = currentGame;
    }
  } else if (testType === 'smoke') {
    console.log(
      `VU ${__VU}: Game ${gameId} already finished with status: ${currentGame.status}, skipping cashout`,
    );
  }

  // Track metrics
  const betAmt = parseFloat(finalResult.betAmount || betAmount);
  const winAmt = parseFloat(finalResult.finalPayout || 0);

  totalBets.add(betAmt);
  totalPayouts.add(winAmt);

  if (testType === 'smoke') {
    console.log(
      `Mines result: ${finalResult.status}, bet: ${betAmt}, payout: ${winAmt}, multiplier: ${finalResult.currentMultiplier || '0.00'}`,
    );
  }

  if (finalResult.status === 'COMPLETED') {
    gameWins.add(1);
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Game WON ✅`);
    }
  } else {
    gameLosses.add(1);
    if (testType === 'smoke') {
      console.log(`VU ${__VU}: Game LOST ❌`);
    }
  }

  // Delay to simulate user thinking time - optimized for performance
  const finalDelay = testType === 'smoke' ? 0.5 : Math.random() * 1 + 1; // 1-2s for load testing (faster)
  sleep(finalDelay);
}
