# Affiliate Commission Calculation

## Overview

Affiliate commissions are calculated based on the **wagered amount**, not deposits. The commission is a percentage of the expected profit from the house edge.

---

## General Formula

```
commission = (houseEdge * wagered / 2) * commissionRate
```

Where:

- `houseEdge` - House advantage (e.g., 1% = 0.01)
- `wagered` - Total amount bet by the player
- `2` - Expected profit divisor (we pay 50% of expected profit)
- `commissionRate` - Affiliate's share (10% = 0.1)

---

## Casino Games

### Formula

```
commission = (houseEdge * wagered / 2) * 0.1
```

### When Paid

- **Immediately** on `bet.confirmed` event
- Triggered as soon as the bet is placed and balance deducted

### Parameters

- `houseEdge` - Game-specific (default 1% if not provided)
  - Dice: 1%
  - Plinko: varies by risk level
  - Mines: varies by mine count
  - etc.
- `wagered` - Amount in crypto (BTC, ETH, USDT, etc.)
- Commission paid in the same asset as the bet

### Examples

#### Example 1: Small Dice Bet

```
Bet: 0.0001 BTC
House Edge: 1%
Commission: (0.01 * 0.0001 / 2) * 0.1 = 0.00000005 BTC
```

#### Example 2: $10,000 Wagered (USD equivalent)

```
Wagered: $10,000
House Edge: 1%
Expected Profit: 0.01 * $10,000 = $100
Affiliate Gets: ($100 / 2) * 0.1 = $5
```

#### Example 3: Multiple Bets

```
5 bets of $0.10 each = $0.50 total
House Edge: 1%
Expected Profit: 0.01 * $0.50 = $0.005
Commission: ($0.005 / 2) * 0.1 = $0.00025 (in crypto equivalent)
```

### Edge Cases

- **Zero amount bets**: Skipped (commission = 0)
- **Refunds**: Not counted as wagers
- **House edge = 0**: Commission = 0

---

## Sportsbook

### Formula

```
commission = (0.03 * wagered / 2) * 0.1
```

### When Paid

- **ONLY after bet settlement** (WON or LOST)
- NOT paid on bet placement
- NOT paid if bet is CANCELED or REFUNDED

### Parameters

- `houseEdge` - Fixed at 3% (0.03) for all sportsbook bets
- `wagered` - Original bet amount (NOT the win amount)
- Commission paid in the player's primary wallet asset

### Data Flow

1. Player places bet → Balance deducted → No commission yet
2. Bet settles as WON/LOST → `sportsbook.bet.settled` event → Commission calculated
3. Bet CANCELED/REFUNDED → No commission

### Examples

#### Example 1: Single $1 Bet (WON)

```
Bet: $1 (100 cents)
House Edge: 3%
Expected Profit: 0.03 * $1 = $0.03
Commission: ($0.03 / 2) * 0.1 = $0.0015
```

#### Example 2: $5 Total Wagered

```
Bet 1: $2 WON
Bet 2: $2 LOST
Bet 3: $1 WON
Total Wagered: $5

Commission per bet:
- Bet 1: (0.03 * $2 / 2) * 0.1 = $0.003
- Bet 2: (0.03 * $2 / 2) * 0.1 = $0.003
- Bet 3: (0.03 * $1 / 2) * 0.1 = $0.0015

Total Commission: $0.0075
```

#### Example 3: Bet Outcomes

```
Player bets $10:

If WON:
- Win amount: $20 (example payout)
- Commission: (0.03 * $10 / 2) * 0.1 = $0.015
- ✅ Commission paid on $10 wagered, NOT on $20 win

If LOST:
- Player loses $10
- Commission: (0.03 * $10 / 2) * 0.1 = $0.015
- ✅ Commission still paid (house won)

If CANCELED:
- Player gets $10 refund
- Commission: $0
- ❌ No commission (no action taken)
```

---

## Technical Implementation

### Casino (bet-confirmed.listener.ts)

```typescript
const houseEdge = payload.houseEdge || 1; // in percent
const expectedProfit = new BigNumber(payload.betAmount)
  .multipliedBy(houseEdge / 100)
  .dividedBy(EXPECTED_PROFIT_DIVISOR); // 2

const commission = expectedProfit
  .multipliedBy(COMMISSION_RATE) // 0.1
  .decimalPlaces(8, BigNumber.ROUND_DOWN);
```

### Sportsbook (sportsbook-bet-settled.listener.ts)

```typescript
// Convert USD cents to crypto first
const betAmountCrypto = this.cryptoConverter.fromCents(payload.betAmountCents, payload.asset);

const expectedProfit = new BigNumber(betAmountCrypto)
  .multipliedBy(SPORTSBOOK_EDGE) // 0.03
  .dividedBy(EXPECTED_PROFIT_DIVISOR); // 2

const commission = expectedProfit
  .multipliedBy(COMMISSION_RATE) // 0.1
  .decimalPlaces(8, BigNumber.ROUND_DOWN);
```

---

## Constants

```typescript
EXPECTED_PROFIT_DIVISOR = 2; // Affiliate gets 50% of expected profit
COMMISSION_RATE = 0.1; // 10% of expected profit
SPORTSBOOK_EDGE = 0.03; // Fixed 3% edge for sportsbook
```

---

## Data Formats

### Casino Games

- `betAmount` arrives in **crypto** (e.g., "0.0001" BTC)
- Commission calculated and stored in same crypto asset
- Event: `bet.confirmed`

### Sportsbook

- `betAmountCents` arrives in **USD cents** (e.g., "100" = $1.00)
- Converted to crypto using `CryptoConverterService.fromCents()`
- Commission calculated and stored in player's primary wallet asset
- Event: `sportsbook.bet.settled`

---

## Minimum Claim Amount

Affiliates can only claim commissions when the total available balance is **$10 USD or more**.

---

## Historical Context

### Previous Model (Deprecated)

- 10% commission on deposits
- Paid immediately on `deposit.completed` event
- Simple but not aligned with actual revenue

### Current Model (Wager-Based)

- Commission based on expected profit from wagered amounts
- More accurate representation of value generated
- Aligns affiliate incentives with platform revenue

---

## Testing

Run simulators to verify commission calculations:

```bash
# Casino games
node apps/backend/src/affiliate/tests/affiliate-flow-simulator.js

# Sportsbook
node apps/backend/src/affiliate/tests/sportsbook-affiliate-simulator.js
```

---

## Related Files

- `/apps/backend/src/affiliate/listeners/bet-confirmed.listener.ts` - Casino commission
- `/apps/backend/src/affiliate/listeners/sportsbook-bet-settled.listener.ts` - Sportsbook commission
- `/apps/backend/src/affiliate/services/affiliate-wallet.service.ts` - Balance management
- `/apps/backend/src/balance/services/crypto-converter.service.ts` - USD ↔ Crypto conversion

---

**Last Updated:** October 2025  
**Version:** 2.0 (Wager-Based Model)
