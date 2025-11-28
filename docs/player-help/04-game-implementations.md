# Provably Fair - Game Implementations

This guide explains how each game on zetik.com generates fair, random outcomes using the provably fair system.

---

## How All Games Work

Every game uses the same basic formula but applies it differently:

```
Server Seed + Client Seed + Nonce + Game Type → Random Result → Game Outcome
```

**The Difference:**

- All games start with the same random number
- Each game has its own way of turning that number into results
- The game type is included in the formula (so same seeds = different results per game)

---

## Dice

### What the Game Does

Roll a number between **0.00 and 100.00**, then bet if it's over or under a target.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "DICE"
- Use HMAC-SHA512 to generate hash
- Convert hash to a number between 0 and 1

**Step 2: Convert to Dice Roll**

- Multiply by 10,001 (gives range 0 to 10,000)
- Divide by 100 (gives range 0.00 to 100.00)

**Example:**

```
Seeds produce: 0.75234 (random float)
Calculation: 0.75234 × 10,001 = 7524.75234
Result: 7524 ÷ 100 = 75.24
Your roll: 75.24
```

### Why This Is Fair

- **All rolls possible**: From 0.00 to exactly 100.00
- **Uniform distribution**: Every number equally likely
- **House edge**: 1% built into payout odds
- **Matches industry standard**: Same formula as Stake.com

---

## Limbo

### What the Game Does

A multiplier is generated. Cash out before it goes too high! Target a specific multiplier or higher.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "LIMBO"
- Use HMAC-SHA512 to generate hash
- Convert hash to a number between 0 and 1

**Step 2: Convert to Multiplier**

- Formula: 0.99 ÷ random number
- Capped at minimum 1.00x

**Example:**

```
Seeds produce: 0.42150 (random float)
Calculation: 0.99 ÷ 0.42150 = 2.35x
Your multiplier: 2.35x
```

### Why This Is Fair

- **Exponential distribution**: Lower multipliers more common, high multipliers rare
- **House edge**: 1% (from using 0.99 instead of 1.00)
- **No maximum**: Theoretically can go to infinity (but extremely rare)
- **Matches industry standard**: Same formula as Stake.com

### Typical Results

- **1.00x - 2.00x**: Very common (~50% of games)
- **2.00x - 10.00x**: Common (~48% of games)
- **10.00x - 100.00x**: Uncommon (~2% of games)
- **100.00x+**: Rare (~0.01% of games)

---

## Crash

### What the Game Does

A multiplier starts at 1.00x and increases. It will "crash" at a predetermined point. Cash out before it crashes!

### How Results Are Generated

**Crash uses a special system:**

**Step 1: Seed Chain**

- We create a chain of 10 million seeds in advance
- Each seed is cryptographically linked to the next
- We publish the LAST seed hash before starting (this proves all seeds exist)

**Step 2: For Each Game**

- Use the next seed in the chain (working backwards)
- Combine with a Bitcoin block hash (adds external randomness)
- Generate crash point using the formula

**Step 3: Formula**

```
1. Take seed + Bitcoin block hash
2. Generate random value using HMAC-SHA512
3. Convert to crash multiplier using exponential formula
4. Apply 1% house edge
```

**Example:**

```
Seed #2,345,678 + Bitcoin Block #815,234
Random value: 0.9234
Calculation: 99 ÷ (0.9234 × 100 - 0.9234)
Result: Crash at 8.23x
```

### Why This Is Fair

- **Pre-commitment**: All 10M seeds exist before first game
- **Bitcoin entropy**: External randomness we can't control
- **Chain verification**: Each seed proves the previous seed
- **House edge**: 1% built into the formula
- **Transparent**: Can verify the entire seed chain

### Special Features

**Bitcoin Block Verification:**

- Every game uses a real Bitcoin block hash
- We can't predict or control Bitcoin blocks
- Adds layer of external randomness

**Seed Chain Verification:**

- Anyone can verify the entire chain
- Start with the published last seed hash
- Hash each seed to verify it matches the next
- Proves all 10M games were predetermined

---

## Plinko

### What the Game Does

Drop a ball that bounces left or right at each peg, landing in a multiplier bucket at the bottom.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "PLINKO"
- Use HMAC-SHA512 to generate hash
- This creates 32 random bytes

**Step 2: Generate Ball Path**

- Ball starts at top center
- For each row of pegs (8, 12, or 16 rows depending on risk level):
  - Use next byte from hash
  - If byte < 128: Ball goes LEFT
  - If byte ≥ 128: Ball goes RIGHT
- Count total left/right moves

**Step 3: Determine Bucket**

- Count where ball lands based on path
- Each bucket has a predetermined multiplier
- More extreme buckets (edges) = higher multipliers

**Example (8 rows, Low Risk):**

```
Bytes: [42, 201, 88, 156, 230, 15, 199, 134]
Path: L, R, L, R, R, L, R, R
Position: 0→-1→0→-1→0→1→0→1→2
Bucket: Position 2 (slightly right)
Multiplier: 1.5x
```

**Example (8 rows, High Risk):**

```
Same path: Position 2
But High Risk buckets have different multipliers
Multiplier: 3.0x (higher risk = higher potential rewards)
```

### Why This Is Fair

- **Binomial distribution**: Most balls land near center (natural probability)
- **Configurable risk**: Choose Low/Medium/High risk levels
- **Different rows**: 8, 12, or 16 rows affect multiplier distribution
- **Matches industry standard**: Same algorithm as Shuffle.com
- **Visible path**: You can see exactly where the ball bounced

### Configuration Options

**Rows:** 8, 12, or 16

- More rows = more pegs = more possible outcomes

**Risk Levels:**

- **Low**: Balanced multipliers (0.5x to 5.6x for 8 rows)
- **Medium**: Moderate multipliers (0.2x to 13x for 8 rows)
- **High**: Extreme multipliers (0x to 29x for 8 rows)

---

## Mines

### What the Game Does

A 5×5 grid with hidden mines. Click tiles to reveal safe spots. More tiles revealed = higher multiplier.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "MINES"
- Use HMAC-SHA512 to generate hash
- Convert to a number between 0 and 1

**Step 2: Shuffle Grid (Fisher-Yates Algorithm)**

- Start with 25 positions: [0, 1, 2, ..., 24]
- For each position (from last to first):
  - Use bytes from hash to pick a random position before it
  - Swap current position with picked position
- Result: Completely randomized grid

**Step 3: Place Mines**

- You choose how many mines (1-24)
- First N positions in shuffled array = mine locations
- Remaining positions = safe tiles

**Example (3 mines):**

```
Shuffled positions: [15, 3, 22, 8, 19, 1, 7, ...]
Mine positions: 15, 3, 22 (first 3 from shuffled array)
Safe positions: All other positions

Grid visualization:
[S][S][S][M][S]   S = Safe
[S][S][M][S][S]   M = Mine
[S][S][S][S][S]
[M][S][S][S][S]
[S][S][S][S][S]
```

### Why This Is Fair

- **Fisher-Yates shuffle**: Industry standard randomization
- **Predetermined**: Mine positions set before you click
- **Verifiable**: Can verify exact shuffle using seeds
- **Transparent**: Mine positions revealed if you cash out or lose
- **Fair odds**: Payouts calculated based on probability

### How Multipliers Work

Each safe tile revealed increases your multiplier:

```
Multiplier = (Total Tiles ÷ Remaining Safe Tiles) × House Edge

Example with 3 mines (22 safe tiles):
Tile 1: 25/22 × 0.99 = 1.125x
Tile 2: 25/21 × 0.99 = 1.179x
Tile 3: 25/20 × 0.99 = 1.238x
... and so on
```

---

## Roulette

### What the Game Does

A wheel with 37 numbers (0-36). Bet on numbers, colors, or ranges.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "ROULETTE"
- Use HMAC-SHA512 to generate hash
- Convert hash to a number between 0 and 1

**Step 2: Map to Wheel**

- Multiply by 37 (gives range 0.00 to 36.99...)
- Take floor (round down)
- Result: Number from 0 to 36

**Example:**

```
Seeds produce: 0.45678 (random float)
Calculation: 0.45678 × 37 = 16.90086
Floor: 16
Result: Number 16 (Red)
```

### Why This Is Fair

- **Uniform distribution**: Every number equally likely (1/37 chance)
- **European wheel**: Single zero (2.7% house edge)
- **Standard payouts**: Same as physical roulette
- **Verifiable**: Can verify exact number from seeds

### Bet Types

All bets are available:

- **Straight**: Single number (35:1)
- **Split**: Two numbers (17:1)
- **Street**: Three numbers (11:1)
- **Corner**: Four numbers (8:1)
- **Red/Black**: 18 numbers (1:1)
- **Odd/Even**: 18 numbers (1:1)
- **Dozens**: 12 numbers (2:1)
- And more...

---

## Blackjack

### What the Game Does

Classic card game. Get closer to 21 than the dealer without going over.

### How Results Are Generated

**Step 1: Create Deck**

- Standard 52-card deck
- Shuffled using Fisher-Yates algorithm
- Uses Server Seed + Client Seed + Nonce + "BLACKJACK"

**Step 2: Deal Cards**

- Each card drawn in order from shuffled deck
- Player gets first two cards (visible)
- Dealer gets one card visible, one hidden
- Continue based on player actions (hit/stand/double/split)

**Step 3: Dealer Rules**

- Dealer must hit on 16 or less
- Dealer must stand on 17 or more
- Automatic, no decisions

**Example:**

```
Shuffled deck: [K♠, 7♥, 3♦, A♣, 9♠, J♥, ...]

Deal:
Player: K♠ (10) + 7♥ (7) = 17
Dealer: 3♦ (3) + A♣ (11) = 14

Player stands on 17
Dealer hits: + 9♠ = 23 (bust!)
Player wins!
```

### Why This Is Fair

- **Fisher-Yates shuffle**: Same proven algorithm as Mines
- **Complete deck**: All 52 cards used
- **Standard rules**: Same as physical casino
- **Dealer automation**: No dealer decisions, only rule-based
- **Verifiable**: Can verify exact deck order from seeds

### Special Bets

**Side Bets:**

- Perfect Pairs (your first two cards are a pair)
- 21+3 (your two cards + dealer up card make poker hand)

**Insurance:**

- Available when dealer shows an Ace
- Pays 2:1 if dealer has blackjack

---

## Keno

### What the Game Does

Pick 1-10 numbers from 1-40. We draw 10 random numbers. Match more = win more.

### How Results Are Generated

**Step 1: Create Random Number**

- Combine: Server Seed + Client Seed + Nonce + "KENO"
- Use HMAC-SHA512 to generate hash

**Step 2: Draw 10 Numbers**

- Use Fisher-Yates shuffle on array [1-40]
- First 10 numbers from shuffled array = drawn numbers
- Similar to Mines algorithm

**Example:**

```
Shuffled: [28, 5, 39, 12, 7, 33, 19, 2, 40, 15, ...]
Drawn numbers: 28, 5, 39, 12, 7, 33, 19, 2, 40, 15

Your picks: 5, 12, 7, 22, 30
Matches: 5, 12, 7 (3 hits)
Payout: Based on 3 hits with 5 picks
```

### Why This Is Fair

- **Fisher-Yates shuffle**: Proven randomization
- **No replacement**: Each number drawn once
- **Standard payouts**: Based on probability
- **Verifiable**: Can verify exact draw order

---

## How to Verify Any Game

### The Universal Process

All games can be verified the same way:

1. **Play your games** (nonce increases each game)
2. **Rotate your seeds** (reveals server seed)
3. **Open bet history** and click "Verify" on any bet
4. **System automatically verifies** using the revealed seed

### What Gets Verified

For every game, verification checks:

- ✅ Server seed matches the hash shown before game
- ✅ Client seed matches what you had set
- ✅ Nonce matches the game number
- ✅ Outcome matches the cryptographic calculation

### Game-Specific Verification

**Dice & Limbo:**

- Verifies the exact number generated

**Crash:**

- Verifies the crash point
- Also verifies seed chain linkage
- Also verifies Bitcoin block hash

**Plinko:**

- Verifies the ball path (each left/right bounce)
- Verifies final bucket position

**Mines:**

- Verifies the complete grid shuffle
- Shows all mine positions

**Roulette:**

- Verifies the winning number
- Shows color and position

**Blackjack:**

- Verifies the complete deck order
- Shows every card that could have been dealt

**Keno:**

- Verifies all 10 drawn numbers
- Shows the shuffle order

---

## Understanding House Edge

### What Is House Edge?

The house edge is the casino's mathematical advantage, built into the game's payout structure.

**Example (Dice):**

- Bet on "Over 50.00"
- True odds: 50% chance of winning
- Fair payout: 2.00x (double your money)
- Actual payout: 1.98x (1% house edge)
- Over many games, casino keeps 1% on average

### House Edge by Game

| Game      | House Edge | How It Works                          |
| --------- | ---------- | ------------------------------------- |
| Dice      | 1.00%      | Built into payout odds                |
| Limbo     | 1.00%      | Uses 0.99 instead of 1.00 in formula  |
| Crash     | 1.00%      | Built into crash point formula        |
| Plinko    | 1.00%      | Built into bucket multipliers         |
| Mines     | 1.00%      | Built into multiplier calculation     |
| Roulette  | 2.70%      | Single zero wheel (standard European) |
| Blackjack | ~0.50%     | Optimal play with standard rules      |
| Keno      | 10.00%     | Standard keno house edge              |

### Why House Edge Matters

- **Sustainability**: Allows casino to operate and pay winners
- **Transparency**: Clearly disclosed, not hidden
- **Fair**: Same for all players, no favoritism
- **Verifiable**: Built into provably fair formulas

---

## Common Questions

### Are the outcomes really predetermined?

**Yes!** The moment seeds are committed:

- Server seed is generated (hash shown to you)
- Client seed is set (by you)
- All future outcomes are determined by these seeds + nonces

We can't change the server seed after showing you the hash!

### Can I use the same seeds multiple times?

**Yes!** Seeds stay active until you rotate them:

- Each game uses the same seeds + incrementing nonce
- Nonce makes each game unique
- You can play thousands of games on one seed pair

### Do different games use different seeds?

**No!** All games use the same seed pair:

- Server seed is shared across all games
- Client seed is shared across all games
- Game type is included in the formula
- Same seeds = different results per game

### How do I know you didn't cherry-pick good server seeds?

Because you add your **client seed**:

- We commit to server seed first (show hash)
- Then you set/change your client seed
- We can't predict the combined result
- Your seed makes outcomes unpredictable to us

### What if I never rotate seeds?

**That's fine!** You can:

- Play forever on the same seed pair
- Rotate anytime you want to verify
- Old bets remain verifiable forever
- No disadvantage to not rotating

### Why do some games feel less random?

**Human perception vs true randomness:**

- True randomness includes streaks and patterns
- Humans expect more "spread out" results
- Math proves fairness via statistical tests
- Provably fair ensures cryptographic randomness

---

## Next Steps

Learn more about provably fair:

- [How to Verify Bets](./02-how-to-verify-bets.md) - Step-by-step verification
- [Commitment Schemes](./03-commitment-schemes.md) - How seeds work
- [Technical Implementation](./05-implementation.md) - Deep dive into the algorithms
- [FAQ](./06-faq.md) - Common questions answered

---

_Last Updated: October 14, 2025_
_Understanding how your games are fair_
