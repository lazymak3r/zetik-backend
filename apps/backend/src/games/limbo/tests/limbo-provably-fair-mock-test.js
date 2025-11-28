/**
 * Limbo ProvablyFairService Mock Test
 *
 * Tests 1,000,000 bets with mocked database
 * to verify house edge without database writes
 */

/* eslint-disable @typescript-eslint/no-require-imports, no-redeclare, @typescript-eslint/require-await */
const crypto = require('crypto');

// Mock ProvablyFairService logic
class MockProvablyFairService {
  constructor() {
    this.nonce = 1;
    this.serverSeed = 'test-server-seed-' + crypto.randomBytes(16).toString('hex');
    this.clientSeed = 'test-client-seed-' + crypto.randomBytes(16).toString('hex');
  }

  calculateOutcome(serverSeed, clientSeed, nonce, gameType, houseEdge = 1.0) {
    // Create HMAC using server seed as key
    const hmac = crypto.createHmac('sha512', serverSeed);

    // Update with client seed, nonce, and game type
    const data = `${clientSeed}:${nonce}:${gameType}`;
    hmac.update(data);

    const hash = hmac.digest('hex');

    // Convert first 8 characters of hash to decimal
    const hexSubstring = hash.substring(0, 8);
    const decimalValue = parseInt(hexSubstring, 16);

    // Normalize to 0-1 range
    const normalizedValue = decimalValue / 0x100000000; // 2^32

    let gameOutcome;

    switch (gameType) {
      case 'LIMBO': {
        // Apply house edge correctly: scale down win probability
        const safeNormalized = Math.max(0.000001, Math.min(0.999999, normalizedValue));

        // Correct formula: outcome = (1 - houseEdge%) / randomValue
        let limboOutcome = (1 - houseEdge / 100) / safeNormalized;

        // Cap at maximum multiplier
        limboOutcome = Math.min(limboOutcome, 1000000);

        // Ensure minimum multiplier
        gameOutcome = Math.max(1.0, limboOutcome);
        break;
      }
      default:
        gameOutcome = normalizedValue;
    }

    return {
      value: gameOutcome,
      hash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
      nonce: nonce.toString(),
      serverSeed,
      clientSeed,
    };
  }

  generateLimboOutcome(userId, betAmount, houseEdge) {
    // Increment nonce (mock database behavior)
    this.nonce++;

    const outcome = this.calculateOutcome(
      this.serverSeed,
      this.clientSeed,
      this.nonce.toString(),
      'LIMBO',
      houseEdge,
    );

    return outcome;
  }
}

// Mock LimboService logic
class MockLimboService {
  constructor() {
    this.provablyFairService = new MockProvablyFairService();
    this.houseEdge = 1.0; // From HouseEdgeService
  }

  calculateWinChance(targetMultiplier, houseEdge) {
    // Unified casino-grade win chance calculation with 6-decimal precision
    const rawWinChance = (100 - houseEdge) / targetMultiplier;
    const roundedWinChance = Math.round(rawWinChance * 1e6) / 1e6;
    return Math.max(0.000001, Math.min(roundedWinChance, 99.99));
  }

  async placeBet(betAmount, targetMultiplier) {
    // Generate provably fair outcome
    const gameOutcome = this.provablyFairService.generateLimboOutcome(
      'test-user-id',
      betAmount.toString(),
      this.houseEdge,
    );

    const resultMultiplier = gameOutcome.value;
    const isWin = resultMultiplier >= targetMultiplier;

    // Calculate win chance
    const winChance = this.calculateWinChance(targetMultiplier, this.houseEdge);

    let winAmount = 0;
    if (isWin) {
      winAmount = betAmount * targetMultiplier;
    }

    return {
      betAmount,
      targetMultiplier,
      resultMultiplier,
      isWin,
      winAmount,
      winChance,
      nonce: gameOutcome.nonce,
    };
  }
}

// Run 1,000,000 bet simulation
async function runMassSimulation() {
  console.log('🔬 Starting Limbo ProvablyFair Mock Test (1,000,000 bets)');
  console.log('═'.repeat(60));

  const limboService = new MockLimboService();

  const BET_AMOUNT = 1; // 1 unit per bet
  const TARGET_MULTIPLIER = 10.0; // 10x multiplier
  const TOTAL_BETS = 1000000;

  let totalBetAmount = 0;
  let totalWinAmount = 0;
  let winCount = 0;
  let lossCount = 0;

  const startTime = Date.now();

  console.log(`Parameters:`);
  console.log(`  Bet Amount: ${BET_AMOUNT} units`);
  console.log(`  Target Multiplier: ${TARGET_MULTIPLIER}x`);
  console.log(`  Total Bets: ${TOTAL_BETS.toLocaleString()}`);
  console.log(
    `  Expected Win Rate: ${limboService.calculateWinChance(TARGET_MULTIPLIER, limboService.houseEdge).toFixed(4)}%`,
  );
  console.log('');

  // Progress tracking
  let progressInterval = Math.floor(TOTAL_BETS / 10);

  for (let i = 0; i < TOTAL_BETS; i++) {
    const result = await limboService.placeBet(BET_AMOUNT, TARGET_MULTIPLIER);

    totalBetAmount += result.betAmount;
    totalWinAmount += result.winAmount;

    if (result.isWin) {
      winCount++;
    } else {
      lossCount++;
    }

    // Progress indicator
    if (i > 0 && i % progressInterval === 0) {
      const progress = ((i / TOTAL_BETS) * 100).toFixed(1);
      const currentHouseEdge = ((totalBetAmount - totalWinAmount) / totalBetAmount) * 100;
      console.log(`Progress: ${progress}% | Current House Edge: ${currentHouseEdge.toFixed(3)}%`);
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Calculate final statistics
  const actualWinRate = (winCount / TOTAL_BETS) * 100;
  const expectedWinRate = limboService.calculateWinChance(
    TARGET_MULTIPLIER,
    limboService.houseEdge,
  );
  const houseEdge = ((totalBetAmount - totalWinAmount) / totalBetAmount) * 100;
  const rtp = (totalWinAmount / totalBetAmount) * 100;

  console.log('');
  console.log('📊 Final Results:');
  console.log('═'.repeat(60));
  console.log(`Total Bets: ${TOTAL_BETS.toLocaleString()}`);
  console.log(`Total Bet Amount: ${totalBetAmount.toLocaleString()} units`);
  console.log(`Total Win Amount: ${totalWinAmount.toFixed(2)} units`);
  console.log('');
  console.log(`Wins: ${winCount.toLocaleString()} (${actualWinRate.toFixed(4)}%)`);
  console.log(
    `Losses: ${lossCount.toLocaleString()} (${((lossCount / TOTAL_BETS) * 100).toFixed(4)}%)`,
  );
  console.log('');
  console.log(`Expected Win Rate: ${expectedWinRate.toFixed(4)}%`);
  console.log(`Actual Win Rate: ${actualWinRate.toFixed(4)}%`);
  console.log(`Win Rate Difference: ${Math.abs(actualWinRate - expectedWinRate).toFixed(4)}%`);
  console.log('');
  console.log(`House Edge: ${houseEdge.toFixed(4)}%`);
  console.log(`RTP: ${rtp.toFixed(4)}%`);
  console.log('');
  console.log(`Player Balance Change: ${(totalWinAmount - totalBetAmount).toFixed(2)} units`);
  console.log(`House Profit: ${(totalBetAmount - totalWinAmount).toFixed(2)} units`);
  console.log('');
  console.log(`Execution Time: ${duration.toFixed(2)} seconds`);
  console.log(`Bets per Second: ${(TOTAL_BETS / duration).toFixed(0)}`);

  // Validation
  console.log('');
  console.log('✅ Validation:');
  if (houseEdge >= 1.0) {
    console.log(`✅ House Edge OK: ${houseEdge.toFixed(4)}% (≥ 1.0%)`);
  } else {
    console.log(`❌ House Edge LOW: ${houseEdge.toFixed(4)}% (< 1.0%)`);
  }

  if (Math.abs(actualWinRate - expectedWinRate) < 0.1) {
    console.log(
      `✅ Win Rate Accuracy OK: Difference ${Math.abs(actualWinRate - expectedWinRate).toFixed(4)}% (< 0.1%)`,
    );
  } else {
    console.log(
      `⚠️  Win Rate Accuracy: Difference ${Math.abs(actualWinRate - expectedWinRate).toFixed(4)}% (≥ 0.1%)`,
    );
  }

  if (totalWinAmount < totalBetAmount) {
    console.log(`✅ Player Lost Money: ${(totalBetAmount - totalWinAmount).toFixed(2)} units`);
  } else {
    console.log(`❌ Player Made Money: ${(totalWinAmount - totalBetAmount).toFixed(2)} units`);
  }
}

// Run the simulation
if (require.main === module) {
  runMassSimulation().catch(console.error);
}

module.exports = { MockProvablyFairService, MockLimboService };
