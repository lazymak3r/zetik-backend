#!/usr/bin/env python3
"""
Calculate theoretical RTP for Plinko HIGH risk using exact binomial probabilities.
This proves mathematically whether the multiplier tables give players an advantage.
"""

from math import comb
from decimal import Decimal, getcontext

# Set high precision for accurate calculations
getcontext().prec = 50

# HIGH risk multiplier tables from plinko.service.ts
MULTIPLIER_TABLES = {
    11: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    13: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    14: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    15: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
}

# Risk bias from code (line 429)
LEFT_PROBABILITY = Decimal('0.499975')  # HIGH risk: -0.0025% edge bias

def binomial_probability(n, k, p):
    """
    Calculate binomial probability: P(X = k) where X ~ Binomial(n, p)

    P(X = k) = C(n, k) * p^k * (1-p)^(n-k)

    n: number of trials (rows)
    k: number of successes (left steps)
    p: probability of success (left probability)
    """
    combinations = Decimal(comb(n, k))
    p_success = p ** k
    p_failure = (Decimal('1') - p) ** (n - k)

    return combinations * p_success * p_failure

def calculate_rtp(rows):
    """
    Calculate theoretical RTP for given number of rows.

    RTP = Sum(P(bucket_i) * multiplier_i) for all buckets

    bucket_index = number of left steps taken
    """
    multipliers = MULTIPLIER_TABLES[rows]

    print(f"\n{'='*80}")
    print(f"HIGH RISK - {rows} ROWS")
    print(f"{'='*80}")
    print(f"Left Probability: {LEFT_PROBABILITY}")
    print(f"Right Probability: {Decimal('1') - LEFT_PROBABILITY}")
    print(f"\nBucket Analysis:")
    print(f"{'Bucket':<8} {'LeftSteps':<12} {'Probability':<20} {'Multiplier':<12} {'Contribution':<20}")
    print(f"{'-'*80}")

    total_rtp = Decimal('0')
    total_prob = Decimal('0')

    for bucket_index in range(len(multipliers)):
        # bucket_index = number of left steps taken
        left_steps = bucket_index

        # Calculate binomial probability
        prob = binomial_probability(rows, left_steps, LEFT_PROBABILITY)
        total_prob += prob

        # Get multiplier for this bucket
        multiplier = Decimal(str(multipliers[bucket_index]))

        # Calculate contribution to RTP
        contribution = prob * multiplier
        total_rtp += contribution

        print(f"{bucket_index:<8} {left_steps:<12} {float(prob):<20.10f} {float(multiplier):<12.2f} {float(contribution):<20.10f}")

    print(f"{'-'*80}")
    print(f"{'TOTALS':<8} {'':<12} {float(total_prob):<20.10f} {'':<12} {float(total_rtp):<20.10f}")
    print(f"\n{'='*80}")
    print(f"THEORETICAL RTP: {float(total_rtp * 100):.8f}%")
    print(f"HOUSE EDGE: {float((Decimal('1') - total_rtp) * 100):.8f}%")
    print(f"{'='*80}\n")

    # Sanity check: total probability should be ~1.0
    if abs(float(total_prob) - 1.0) > 0.0001:
        print(f"⚠️  WARNING: Total probability = {float(total_prob):.10f} (should be 1.0)")

    return float(total_rtp)

def main():
    print("\n" + "="*80)
    print(" PLINKO HIGH RISK - THEORETICAL RTP CALCULATION")
    print(" Using exact binomial probabilities")
    print("="*80)

    results = {}

    for rows in [11, 12, 13, 14, 15, 16]:
        rtp = calculate_rtp(rows)
        results[rows] = rtp

    print("\n" + "="*80)
    print(" SUMMARY - ALL HIGH RISK CONFIGURATIONS")
    print("="*80)
    print(f"{'Rows':<8} {'RTP':<15} {'House Edge':<15} {'Status':<20}")
    print("-"*80)

    for rows in sorted(results.keys()):
        rtp = results[rows]
        house_edge = (1 - rtp) * 100

        if rtp > 1.0:
            status = "❌ PLAYER ADVANTAGE"
        elif rtp > 0.99:
            status = "✅ OK (Near target)"
        else:
            status = "✅ OK"

        print(f"{rows:<8} {rtp*100:.8f}%   {house_edge:>7.4f}%      {status:<20}")

    print("="*80)

    # Critical findings
    print("\n" + "="*80)
    print(" CRITICAL FINDINGS")
    print("="*80)

    negative_edge_count = sum(1 for rtp in results.values() if rtp > 1.0)

    if negative_edge_count > 0:
        print(f"⚠️  {negative_edge_count} configurations have NEGATIVE house edge (player wins!)")
        print(f"⚠️  This is mathematically IMPOSSIBLE for a casino game")
        print(f"⚠️  The multiplier tables are INCORRECT")
    else:
        print("✅ All configurations have positive house edge")

    print("="*80 + "\n")

if __name__ == "__main__":
    main()
