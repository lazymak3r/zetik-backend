/* global __ENV */
import http from 'k6/http';
import { listenBalanceUpdates } from './balance-events.js';
import { config } from './config.js';
import { playDice, setupDice } from './games/dice/dice.js';
import { playMines, setupMines } from './games/mines/mines.js';
import { playPlinko, setupPlinko } from './games/plinko/plinko.js';

// Test configuration
const TEST_TYPE = __ENV.TEST_TYPE || 'smoke'; // smoke or load
const GAME = __ENV.GAME || 'dice'; // dice, plinko, blackjack, etc.

// Override options with ENV variables if provided
function getTestOptions() {
  const baseOptions = TEST_TYPE === 'smoke' ? config.smokeOptions : config.loadOptions;

  // Check for custom DURATION and VUS from environment
  const customDuration = __ENV.DURATION;
  const customVUs = __ENV.VUS ? parseInt(__ENV.VUS) : null;

  if (customDuration || customVUs) {
    const duration = customDuration || '1m';
    const vus = customVUs || 5;

    console.log(`🔧 Using custom options: VUs=${vus}, Duration=${duration}`);

    return {
      ...baseOptions,
      stages: [{ duration: duration, target: vus }],
    };
  }

  return baseOptions;
}

// Set test options based on type and ENV overrides
export const options = getTestOptions();

function checkServerHealth() {
  console.log(`🔍 Checking server health: ${config.domain}`);

  try {
    const response = http.get(`${config.domain}/v1/health`, {
      timeout: '10s',
    });

    if (response.status === 200) {
      try {
        const body = response.json();
        if (body.status === 'ok') {
          console.log(`✅ Server is healthy (${response.status})`);
          return true;
        } else {
          console.error(`❌ Server unhealthy - Invalid response: ${JSON.stringify(body)}`);
          return false;
        }
      } catch {
        console.error(`❌ Server unhealthy - Invalid JSON response: ${response.body}`);
        return false;
      }
    } else {
      console.error(`❌ Server unhealthy - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Server unreachable - Error: ${error}`);
    return false;
  }
}

export function setup() {
  // Check server health before starting tests
  if (!checkServerHealth()) {
    console.error('🛑 Aborting tests - Server is not available');
    return null;
  }

  let gameData = null;

  // Route to specific game setup
  switch (GAME.toLowerCase()) {
    case 'dice':
      gameData = setupDice(TEST_TYPE);
      break;
    case 'mines':
      gameData = setupMines(TEST_TYPE);
      break;
    case 'plinko':
      gameData = setupPlinko(TEST_TYPE);
      break;
    default:
      console.error(`Unknown game: ${GAME}`);
      return null;
  }

  // Start listening to balance events if authentication succeeded
  if (gameData && gameData.token) {
    listenBalanceUpdates(gameData.token, config.domain);
  }

  return gameData;
}

export default function (data) {
  // Route to specific game
  switch (GAME.toLowerCase()) {
    case 'dice':
      playDice(data, TEST_TYPE);
      break;
    case 'mines':
      playMines(data, TEST_TYPE);
      break;
    case 'plinko':
      playPlinko(data, TEST_TYPE);
      break;
    default:
      console.error(`Unknown game: ${GAME}`);
      return;
  }
}
