#!/usr/bin/env ts-node
/**
 * Manual RTP calculation for HIGH risk Plinko to verify house edge
 */

// Binomial coefficient calculation
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;

  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - i + 1) / i;
  }
  return result;
}

// Calculate binomial probability
function binomialProbability(n: number, k: number, p: number): number {
  const coefficient = binomialCoefficient(n, k);
  const probability = coefficient * Math.pow(p, k) * Math.pow(1 - p, n - k);
  return probability;
}

// HIGH risk multiplier tables
const HIGH_MULTIPLIERS = {
  8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  9: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  10: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
  12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
  14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
  15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
  16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
};

const HIGH_RISK_P = 0.499975; // Probability of going left

function calculateRTP(rows: number): {
  rtp: number;
  houseEdge: number;
  details: Array<{ bucket: number; probability: string; multiplier: string; contribution: string }>;
} {
  const multipliers = HIGH_MULTIPLIERS[rows];
  const bucketCount = rows + 1;

  let expectedValue = 0;
  const details: Array<{
    bucket: number;
    probability: string;
    multiplier: string;
    contribution: string;
  }> = [];

  for (let k = 0; k < bucketCount; k++) {
    const probability = binomialProbability(rows, k, HIGH_RISK_P);
    const multiplier = multipliers[k];
    const contribution = probability * multiplier;

    expectedValue += contribution;
    details.push({
      bucket: k,
      probability: (probability * 100).toFixed(6) + '%',
      multiplier: multiplier + 'x',
      contribution: contribution.toFixed(8),
    });
  }

  const rtp = expectedValue * 100; // Convert to percentage
  const houseEdge = (1 - expectedValue) * 100;

  return { rtp, houseEdge, details };
}

console.log('='.repeat(80));
console.log('HIGH RISK PLINKO - MANUAL RTP CALCULATION');
console.log('='.repeat(80));
console.log(`Probability of left: ${HIGH_RISK_P}`);
console.log('');

// Calculate for rows 11-16
for (let rows = 11; rows <= 16; rows++) {
  const result = calculateRTP(rows);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`HIGH RISK ${rows} ROWS`);
  console.log(`${'='.repeat(80)}`);
  console.log(`Expected RTP: ${result.rtp.toFixed(4)}%`);
  console.log(`House Edge: ${result.houseEdge.toFixed(4)}%`);
  console.log('');
  console.log('Bucket | Probability | Multiplier | Contribution');
  console.log('-'.repeat(60));

  result.details.forEach((detail) => {
    const bucketStr = detail.bucket.toString().padEnd(6);
    const probStr = detail.probability.padEnd(11);
    const multStr = detail.multiplier.padEnd(10);
    const contStr = detail.contribution.padEnd(12);
    console.log(`${bucketStr} | ${probStr} | ${multStr} | ${contStr}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));

for (let rows = 11; rows <= 16; rows++) {
  const result = calculateRTP(rows);
  const status = result.houseEdge < 0 ? '⚠️  PLAYER ADVANTAGE!' : '✓ Casino advantage';
  console.log(
    `HIGH ${rows} rows: RTP=${result.rtp.toFixed(2)}%, House Edge=${result.houseEdge.toFixed(2)}% ${status}`,
  );
}
