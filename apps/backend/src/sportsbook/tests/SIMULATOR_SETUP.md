# Sportsbook Flow Simulator - Setup & Restore Guide

Complete guide for running and restoring the sportsbook betting flow simulator with affiliate commission tracking.

---

## Quick Start

### Prerequisites

1. Backend server running on port 4000
2. PostgreSQL database running

### Run Simulator

```bash
cd apps/backend/src/sportsbook/tests

API_URL=http://localhost:4000/v1 \
ADMIN_SECRET=admin-secret-key \ /* just for example */
node sportsbook-flow-simulator.js
```

### Expected Results

- **Success Rate:** ~92-100%
- All commission tests should pass
- Only "Claim" test may fail (requires minimum $10)

---

## What Gets Modified

Only **2 files** are changed for testing:

### 1. Interceptor

**File:** `apps/backend/src/sportsbook/interceptors/betby-jwt.interceptor.ts`

**Change:** Add exception for test endpoints to bypass JWT signature verification.

### 2. Controller

**File:** `apps/backend/src/sportsbook/betby.controller.ts`

**Change:** Add 3 test endpoints that proxy to real service methods.

### Service (NOT MODIFIED)

**File:** `apps/backend/src/sportsbook/betby.service.ts`

**Original business logic remains unchanged:**

- `makeBet()` - bet placement logic
- `win()` - win settlement with commission (lines 314-322)
- `lost()` - lost settlement with commission

---

## How To Restore After Rollback

If you've rolled back the changes, follow these steps to restore test functionality:

### Step 1: Update Interceptor

**File:** `apps/backend/src/sportsbook/interceptors/betby-jwt.interceptor.ts`

Find this code (around line 24-31):

```typescript
if (
  url &&
  (url.includes('/sportsbook/betby/ping') || url.includes('/sportsbook/betby/token/generate'))
) {
  return next.handle();
}
```

**Add one line:**

```typescript
if (
  url &&
  (url.includes('/sportsbook/betby/ping') ||
    url.includes('/sportsbook/betby/token/generate') ||
    url.includes('/sportsbook/betby/test/')) // <-- ADD THIS LINE
) {
  return next.handle();
}
```

### Step 2: Add Test Endpoints to Controller

**File:** `apps/backend/src/sportsbook/betby.controller.ts`

Add these 3 methods at the end of the `BetbyController` class (before the closing `}`):

#### Endpoint 1: Place Bet

```typescript
  @Post('test/place-bet')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test endpoint - calls makeBet bypassing signature' })
  async testPlaceBet(
    @CurrentUser() user: UserEntity,
    @Body() body: { betAmount: number; odds: number },
  ) {
    // Proxy to makeBet with fake Betby payload
    const result = await this.betbyService.makeBet({
      player_id: user.id,
      amount: body.betAmount,
      currency: 'USD',
      session_id: 'test-session',
      transaction: {
        id: `test-${Date.now()}`,
        betslip_id: `betslip-${Date.now()}`,
        player_id: user.id,
        operator_id: 'test-operator',
        operator_brand_id: 'test-brand',
        ext_player_id: user.id,
        timestamp: Math.floor(Date.now() / 1000),
        amount: body.betAmount,
        currency: 'USD',
        operation: 'bet',
      },
      betslip: {
        id: `betslip-${Date.now()}`,
        timestamp: Math.floor(Date.now() / 1000),
        player_id: user.id,
        operator_id: 'test-operator',
        operator_brand_id: 'test-brand',
        ext_player_id: user.id,
        currency: 'USD',
        type: 'single',
        sum: body.betAmount,
        k: body.odds.toString(),
        bets: [
          {
            id: `selection-${Date.now()}`,
            event_id: 'test-event',
            sport_id: 'test-sport',
            tournament_id: 'test-tournament',
            category_id: 'test-category',
            live: false,
            sport_name: 'Test Sport',
            category_name: 'Test',
            tournament_name: 'Test',
            market_name: 'Test Market',
            outcome_name: 'Test',
            scheduled: Math.floor(Date.now() / 1000),
            odds: body.odds.toString(),
          },
        ],
      },
      potential_win: body.betAmount * body.odds,
    });
    return { betId: result.id, betAmount: body.betAmount };
  }
```

#### Endpoint 2: Mark Won

```typescript
  @Post('test/mark-won')
  @HttpCode(200)
  @ApiOperation({ summary: 'Test endpoint - calls win() bypassing signature' })
  async testMarkWon(@Body() body: { betId: string; winAmount: number }) {
    // Proxy to win() with fake Betby payload
    // winAmount already in cents from simulator
    await this.betbyService.win({
      bet_transaction_id: body.betId,
      amount: body.winAmount,
      currency: 'USD',
      is_cashout: false,
      transaction: {
        id: `win-${Date.now()}`,
        betslip_id: body.betId,
        player_id: '',
        operator_id: 'test',
        operator_brand_id: 'test',
        ext_player_id: '',
        timestamp: Math.floor(Date.now() / 1000),
        amount: body.winAmount,
        currency: 'USD',
        operation: 'win',
      },
      selections: [],
    });
    return { success: true, betId: body.betId };
  }
```

#### Endpoint 3: Mark Lost

```typescript
  @Post('test/mark-lost')
  @HttpCode(200)
  @ApiOperation({ summary: 'Test endpoint - calls lost() bypassing signature' })
  async testMarkLost(@Body() body: { betId: string }) {
    // Proxy to lost() with fake Betby payload
    await this.betbyService.lost({
      bet_transaction_id: body.betId,
      amount: 0,
      currency: 'USD',
      transaction: {
        id: `lost-${Date.now()}`,
        betslip_id: body.betId,
        player_id: '',
        operator_id: 'test',
        operator_brand_id: 'test',
        ext_player_id: '',
        timestamp: Math.floor(Date.now() / 1000),
        amount: 0,
        currency: 'USD',
        operation: 'lost',
      },
      selections: [],
    });
    return { success: true, betId: body.betId };
  }
```

### Step 3: Verify Build

```bash
pnpm --filter @zetik/backend build
```

Should complete without errors.

---

## Important Details

### Critical: Do NOT Multiply Amounts

The simulator **already sends amounts in CENTS**:

```javascript
// Simulator code:
winAmount: parseFloat(winAmount) * 100; // already in cents
```

Controller must pass amounts as-is:

```typescript
amount: body.winAmount,  // ✅ correct (already in cents)
// NOT: Math.round(body.winAmount * 100)  // ❌ would be 100x larger!
```

### Architecture Flow

```
Simulator (sends amounts in CENTS)
    ↓
Controller test endpoints (passes as-is)
    ↓
BetbyService.makeBet() / win() / lost()
    ↓
Real business logic with commission
```

---

## What Simulator Tests

1. **Commission NOT paid on bet placement** - verifies commission is only on settlement
2. **Won bet commission calculation** - verifies 0.15% commission on wins
3. **Lost bet commission calculation** - verifies 0.15% commission on losses
4. **Multiple bets accumulation** - verifies commission accumulates correctly
5. **Balance updates** - verifies deductions and payouts are correct
6. **Claim commission** - attempts to claim (may fail if < $10)

### Commission Formula

```
Commission = wagered × 0.0015
           = wagered × (3% / 2 × 10%)
```

Where:

- `house_edge` = 3% (for sportsbook)
- `commission_rate` = 10%

Example: $100 wagered → $0.15 commission

---

## Database Verification

### Check Affiliate Wallet

```sql
SELECT "userId", asset, "totalEarned", balance, wagered
FROM affiliate.affiliate_wallets
WHERE "userId" = '<AFFILIATE_USER_ID>'
  AND asset = 'BTC';
```

Expected changes:

- `totalEarned` increases
- `balance` increases (if not claimed)
- `wagered` increases

### Check Affiliate Earnings

```sql
SELECT "referredUserId", asset, earned, wagered
FROM affiliate.affiliate_earnings
WHERE "affiliateId" = '<AFFILIATE_USER_ID>'
ORDER BY wagered DESC
LIMIT 5;
```

### Debug Bet Amounts

```sql
-- Check stored amounts (in CENTS)
SELECT
  status,
  "betAmount",
  "actualWin",
  "totalOdds",
  "createdAt"
FROM games.sportsbook_bets
WHERE "userId" = '<USER_ID>'
ORDER BY "createdAt" DESC
LIMIT 10;

-- Check display amounts (in USD)
SELECT
  "betAmountUsd",
  "payoutUsd",
  multiplier
FROM games.user_bets
WHERE "userId" = '<USER_ID>'
  AND game = 'SPORTSBOOK'
ORDER BY "createdAt" DESC
LIMIT 10;
```

**Note:** `betAmount` and `actualWin` are stored in CENTS in database.

---

## Troubleshooting

### Error: "Missing Betby payload"

**Cause:** Interceptor not allowing test endpoints.

**Fix:** Verify `url.includes('/sportsbook/betby/test/')` is added to interceptor.

### Error: "Unexpected end of JSON input"

**Cause:** Backend hasn't fully started yet.

**Fix:** Wait 10-15 seconds after starting backend, then run simulator.

### Amounts are 100x larger

**Cause:** Controller multiplying by 100, but simulator already sends in cents.

**Fix:** Use `body.winAmount` directly, without `Math.round(body.winAmount * 100)`.

### Commission not accumulating

**Cause:** BetbyService may be modified.

**Fix:** Verify `win()` and `lost()` methods call `affiliateCommissionService.accumulateCommission()`.

### Database shows wrong amounts

**Cause:** Unit confusion (cents vs dollars).

**Fix:**

- `sportsbook_bets.betAmount` is in CENTS (10000 = $100)
- `user_bets.betAmountUsd` is in USD (100.00 = $100)

---

## Rollback Changes

To remove test functionality:

```bash
git checkout apps/backend/src/sportsbook/betby.controller.ts
git checkout apps/backend/src/sportsbook/interceptors/betby-jwt.interceptor.ts
```

To restore, follow the "How To Restore" section above.

---

## Checklist

- [ ] Updated `betby-jwt.interceptor.ts` (added `/test/` exception)
- [ ] Added 3 endpoints to `betby.controller.ts`
- [ ] Build completes without errors
- [ ] Backend running on port 4000
- [ ] Simulator runs with correct environment variables
- [ ] Success rate >= 90%
- [ ] Database shows correct amounts

---

## Summary

**Modified Files:**

1. `apps/backend/src/sportsbook/betby.controller.ts` - 3 test endpoints added
2. `apps/backend/src/sportsbook/interceptors/betby-jwt.interceptor.ts` - 1 line added

**Not Modified:**

- `apps/backend/src/sportsbook/betby.service.ts` - original business logic unchanged

**Key Points:**

- Test endpoints are thin proxies to real service methods
- Commission logic lives in original `win()` and `lost()` methods
- Amounts are in CENTS from simulator - pass them as-is
- All tests use real business logic - nothing is mocked
