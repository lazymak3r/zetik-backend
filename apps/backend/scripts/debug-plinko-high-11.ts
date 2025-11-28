#!/usr/bin/env ts-node
/**
 * Debug script to understand HIGH risk 11 rows discrepancy
 */

import * as crypto from 'crypto';

// HIGH risk 11 rows multiplier table
const MULTIPLIERS = [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120];
const HIGH_RISK_P = 0.499975;
const ROWS = 11;

// Binomial coefficient
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - i + 1) / i;
  }
  return result;
}

// Simulate ball drop (exact copy from simulation suite)
function simulateBallDrop(serverSeed: string, clientSeed: string, nonce: number): number {
  let leftSteps = 0;

  for (let row = 1; row <= ROWS; row++) {
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

    const goesLeft = randomValue < HIGH_RISK_P;
    if (goesLeft) {
      leftSteps++;
    }
  }

  return leftSteps;
}

console.log('='.repeat(80));
console.log('DEBUGGING HIGH RISK 11 ROWS');
console.log('='.repeat(80));
console.log(`Probability of left: ${HIGH_RISK_P}`);
console.log(`Multiplier table: [${MULTIPLIERS.join(', ')}]`);
console.log('');

// 1. Theoretical calculation
console.log('1. THEORETICAL CALCULATION (Binomial Distribution)');
console.log('-'.repeat(80));

let theoreticalRTP = 0;
for (let k = 0; k <= ROWS; k++) {
  const coefficient = binomialCoefficient(ROWS, k);
  const probability = coefficient * Math.pow(HIGH_RISK_P, k) * Math.pow(1 - HIGH_RISK_P, ROWS - k);
  const multiplier = MULTIPLIERS[k];
  const contribution = probability * multiplier;
  theoreticalRTP += contribution;

  console.log(
    `Bucket ${k.toString().padStart(2)}: P=${(probability * 100).toFixed(6)}% × ${multiplier.toString().padEnd(6)}x = ${contribution.toFixed(8)}`,
  );
}

const theoreticalHouseEdge = (1 - theoreticalRTP) * 100;
console.log('');
console.log(`Theoretical RTP: ${(theoreticalRTP * 100).toFixed(4)}%`);
console.log(`Theoretical House Edge: ${theoreticalHouseEdge.toFixed(4)}%`);
console.log('');

// 2. Simulation with same seeds as suite
console.log('2. SIMULATION (Same seeds as test suite)');
console.log('-'.repeat(80));

const serverSeed = 'test-server-seed-plinko-HIGH-11';
const clientSeed = 'test-client-seed-plinko-HIGH-11';
const simulations = 1000000;

const bucketCounts = new Array(12).fill(0);
let totalMultiplier = 0;

for (let i = 0; i < simulations; i++) {
  const bucketIndex = simulateBallDrop(serverSeed, clientSeed, i + 1);
  bucketCounts[bucketIndex]++;
  totalMultiplier += MULTIPLIERS[bucketIndex];
}

console.log('Bucket distribution:');
for (let k = 0; k <= ROWS; k++) {
  const count = bucketCounts[k];
  const percentage = (count / simulations) * 100;
  const multiplier = MULTIPLIERS[k];
  const contribution = (count / simulations) * multiplier;

  console.log(
    `Bucket ${k.toString().padStart(2)}: ${count.toString().padStart(8)} hits (${percentage.toFixed(6)}%) × ${multiplier.toString().padEnd(6)}x = ${contribution.toFixed(8)}`,
  );
}

const simulatedRTP = totalMultiplier / simulations;
const simulatedHouseEdge = (1 - simulatedRTP) * 100;

console.log('');
console.log(`Simulated RTP: ${(simulatedRTP * 100).toFixed(4)}%`);
console.log(`Simulated House Edge: ${simulatedHouseEdge.toFixed(4)}%`);
console.log('');

// 3. Compare
console.log('3. COMPARISON');
console.log('-'.repeat(80));
console.log(`Theoretical RTP:  ${(theoreticalRTP * 100).toFixed(4)}%`);
console.log(`Simulated RTP:    ${(simulatedRTP * 100).toFixed(4)}%`);
console.log(`Difference:       ${((simulatedRTP - theoreticalRTP) * 100).toFixed(4)}%`);
console.log('');
console.log(`Theoretical HE:   ${theoreticalHouseEdge.toFixed(4)}%`);
console.log(`Simulated HE:     ${simulatedHouseEdge.toFixed(4)}%`);
console.log(`Difference:       ${(simulatedHouseEdge - theoreticalHouseEdge).toFixed(4)}%`);
console.log('');

// 4. Check for bias in specific seed
console.log('4. SEED BIAS ANALYSIS');
console.log('-'.repeat(80));
console.log('Testing first 20 nonces to see pattern:');
for (let nonce = 1; nonce <= 20; nonce++) {
  const bucketIndex = simulateBallDrop(serverSeed, clientSeed, nonce);
  const multiplier = MULTIPLIERS[bucketIndex];
  console.log(
    `Nonce ${nonce.toString().padStart(2)}: Bucket ${bucketIndex.toString().padStart(2)} → ${multiplier.toString().padEnd(6)}x`,
  );
}
