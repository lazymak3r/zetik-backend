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

export function setupPlinko(testType) {
  console.log(`Starting PLINKO ${testType} test`);
  authData = login();
  return authData;
}

export function playPlinko(data, testType) {
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
  const rowCount = 16; // Maximum rows for best statistical distribution
  const riskLevel = 'MEDIUM'; // Balanced risk for consistent testing

  if (testType === 'smoke') {
    console.log(`Making PLINKO bet: ${betAmount} BTC, ${rowCount} rows, ${riskLevel} risk`);
  }

  const betResponse = http.post(
    `${config.domain}/v1/games/plinko/bet`,
    JSON.stringify({
      betAmount: betAmount.toFixed(8),
      rowCount: rowCount,
      riskLevel: riskLevel,
      clientSeed: `k6-${testType}-${Date.now()}-${Math.random()}`,
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
    'valid bucket index': (r) => {
      const bucketIndex = r.json('bucketIndex');
      return bucketIndex >= 0 && bucketIndex <= rowCount;
    },
    'valid ball path': (r) => {
      const ballPath = r.json('ballPath');
      return Array.isArray(ballPath) && ballPath.length === rowCount + 1;
    },
    'valid multiplier': (r) => {
      const multiplier = parseFloat(r.json('multiplier'));
      return multiplier >= 0;
    },
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
        `Plinko result: bucket ${result.bucketIndex}, bet: ${betAmt}, win: ${winAmt}, multiplier: ${result.multiplier}x, path: [${result.ballPath.join(',')}]`,
      );
    }

    // Plinko always has a win (even if multiplier is 0)
    // Track based on profitability
    if (winAmt > betAmt) {
      gameWins.add(1);
    } else {
      gameLosses.add(1);
    }

    // Additional Plinko-specific validations
    if (testType === 'smoke') {
      // Verify provably fair data
      const serverSeedHash = result.serverSeedHash;
      const nonce = result.nonce;

      if (serverSeedHash && nonce) {
        console.log(`Provably fair: hash ${serverSeedHash.substring(0, 8)}..., nonce: ${nonce}`);
      }

      // Verify physics makes sense
      const ballPath = result.ballPath;
      const bucketIndex = result.bucketIndex;

      if (ballPath && ballPath.length > 0) {
        const finalPosition = ballPath[ballPath.length - 1];
        if (finalPosition === bucketIndex) {
          console.log('✅ Ball path consistent with final bucket');
        } else {
          console.log(`❌ Ball path inconsistent: final=${finalPosition}, bucket=${bucketIndex}`);
        }
      }
    }
  } else if (testType === 'smoke') {
    console.error(`Plinko bet failed: ${betResponse.status} ${betResponse.body}`);
  }

  sleep(testType === 'smoke' ? 1 : config.betting.delayMs / 1000);
}
