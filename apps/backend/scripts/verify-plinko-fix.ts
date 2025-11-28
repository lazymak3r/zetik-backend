#!/usr/bin/env ts-node
/**
 * Quick verification script for Plinko simulation cap fix
 * Tests HIGH risk configurations with specified simulation count
 */

import * as crypto from 'crypto';

const MULTIPLIER_TABLES = {
  HIGH: {
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

function generatePlinkoBallDrop(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rowCount: number,
): { bucketIndex: number; multiplier: number } {
  const leftProbability = 0.499975; // HIGH risk
  let leftSteps = 0;

  for (let row = 1; row <= rowCount; row++) {
    const hmac = crypto.createHmac('sha512', serverSeed);
    const data = `${clientSeed}:${nonce}:${row - 1}`;
    hmac.update(data);
    const hash = hmac.digest('hex');
    const hashBytes = Buffer.from(hash, 'hex');

    const DIVISORS = [256, 65536, 16777216, 4294967296];
    let randomValue = 0;
    for (let j = 0; j < 4; j++) {
      const byte = hashBytes[j];
      randomValue += byte / DIVISORS[j];
    }

    if (randomValue < leftProbability) {
      leftSteps++;
    }
  }

  const multiplierTable = MULTIPLIER_TABLES.HIGH[rowCount];
  const multiplier = multiplierTable[leftSteps];

  return { bucketIndex: leftSteps, multiplier };
}

function runTest(simulations: number, rows: number) {
  const serverSeed = `test-plinko-fix-HIGH-${rows}`;
  const clientSeed = `test-plinko-fix-client-${rows}`;
  const multipliers: number[] = [];

  console.log(
    `\nTesting HIGH risk ${rows} rows with ${simulations.toLocaleString()} simulations...`,
  );

  for (let i = 0; i < simulations; i++) {
    const { multiplier } = generatePlinkoBallDrop(serverSeed, clientSeed, i + 1, rows);
    multipliers.push(multiplier);
  }

  const avgMultiplier = multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length;
  const houseEdge = (1 - avgMultiplier) * 100;

  console.log(`  Average Multiplier: ${avgMultiplier.toFixed(6)}x`);
  console.log(`  House Edge: ${houseEdge.toFixed(4)}%`);
  console.log(`  Status: ${houseEdge > 0 && houseEdge < 3 ? '✅ PASS' : '❌ FAIL'}`);

  return { avgMultiplier, houseEdge };
}

// Parse simulation count from command line
const args = process.argv.slice(2);
const simCount = args[0] ? parseInt(args[0]) : 1000000;

console.log('═══════════════════════════════════════════════════════════');
console.log('🎯 Plinko Simulation Cap Fix Verification');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Simulation count: ${simCount.toLocaleString()}`);

const startTime = Date.now();

// Test the problematic HIGH risk configurations
const results = [
  runTest(simCount, 11),
  runTest(simCount, 12),
  runTest(simCount, 13),
  runTest(simCount, 14),
  runTest(simCount, 15),
  runTest(simCount, 16),
];

const elapsed = (Date.now() - startTime) / 1000;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Summary:');
console.log(`  Total time: ${elapsed.toFixed(2)}s`);

const allPositive = results.every((r) => r.houseEdge > 0);
const avgHouseEdge = results.reduce((sum, r) => sum + r.houseEdge, 0) / results.length;

console.log(`  Average house edge: ${avgHouseEdge.toFixed(4)}%`);
console.log(`  All positive: ${allPositive ? '✅ YES' : '❌ NO'}`);
console.log('═══════════════════════════════════════════════════════════\n');
