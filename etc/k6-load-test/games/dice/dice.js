import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { login } from '../../auth.js';
import { config } from '../../config.js';

const gameWins = new Counter('game_wins');
const gameLosses = new Counter('game_losses');
const totalBets = new Counter('total_bet_amount');
const totalPayouts = new Counter('total_payout_amount');

let authData = null;

export function setupDice(testType) {
  console.log(`Starting DICE ${testType} test`);
  authData = login();
  return authData;
}

export function playDice(data, testType) {
  // If setup failed (server health check or login), don't run tests
  if (data === null) {
    console.log('Skipping iteration - setup failed');
    return;
  }

  if (!authData) {
    authData = data || login();
  }

  const betAmount =
    testType === 'smoke'
      ? config.betting.minBet
      : Math.random() * (config.betting.maxBet - config.betting.minBet) + config.betting.minBet;

  // Fixed parameters for consistent house edge analysis
  const target = 50.0;
  const isOver = true; // ROLL_OVER for consistent 49.99% win chance

  if (testType === 'smoke') {
    console.log(`Making DICE bet: ${betAmount} ${isOver ? 'ROLL_OVER' : 'ROLL_UNDER'} ${target}`);
  }

  const betResponse = http.post(
    `${config.domain}/v1/games/dice/bet`,
    JSON.stringify({
      betAmount: betAmount.toFixed(8),
      betType: isOver ? 'ROLL_OVER' : 'ROLL_UNDER',
      targetNumber: target,
      clientSeed: `k6-${testType}-${Date.now()}`,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authData.token}`,
      },
    },
  );

  if (betResponse.status === 401) {
    console.log('Token expired, re-authenticating...');
    authData = login();
    if (!authData) return;
    return; // Skip this iteration, retry next time
  }

  const success = check(betResponse, {
    'bet placed successfully': (r) => r.status === 201,
    'valid response format': (r) => r.json('id') !== undefined,
    'bet amount correct': (r) => r.json('betAmount') === betAmount.toFixed(8),
  });

  if (success && betResponse.status === 201) {
    const result = betResponse.json();

    // Track bet and payout amounts for house edge calculation
    const betAmt = parseFloat(result.betAmount);
    const winAmt = parseFloat(result.winAmount || 0);

    totalBets.add(betAmt);
    totalPayouts.add(winAmt);

    if (testType === 'smoke') {
      console.log(
        `Bet result: ${result.status}, roll: ${result.rollResult}, bet: ${betAmt}, win: ${winAmt}, multiplier: ${result.multiplier}`,
      );
    }

    if (result.status === 'WON') {
      gameWins.add(1);
    } else {
      gameLosses.add(1);
    }
  } else if (testType === 'smoke') {
    console.error(`Bet failed: ${betResponse.status} ${betResponse.body}`);
  }

  sleep(testType === 'smoke' ? 1 : config.betting.delayMs / 1000);
}
