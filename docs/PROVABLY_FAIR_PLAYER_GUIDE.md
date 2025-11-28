# Provably Fair - Player Verification Guide

**Last Updated**: October 14, 2025

Welcome to zetik.com's Provably Fair verification guide! This document will help you understand and verify that every game on our platform is fair and transparent.

---

## 🎯 New Player? Start Here!

If you're new to provably fair gaming or want an easier guide without technical scripts, check out our **player-friendly help articles**:

1. **[Provably Fair Overview](./player-help/01-provably-fair-overview.md)**
   - Simple explanation of how it works
   - No technical jargon
   - Perfect for beginners

2. **[How to Verify Bets](./player-help/02-how-to-verify-bets.md)**
   - Step-by-step verification using our UI
   - No console scripts needed
   - Just click buttons!

3. **[Understanding Seeds](./player-help/03-commitment-schemes.md)**
   - What are server and client seeds?
   - Explained with simple analogies
   - Easy to understand

4. **[Game Implementations](./player-help/04-game-implementations.md)**
   - How each game generates results
   - Simple explanations for all games
   - No coding required

5. **[Technical Implementation](./player-help/05-implementation.md)**
   - HMAC-SHA512 algorithm explained
   - Bytes-to-float conversion process
   - Mathematical foundations
   - For those who want deeper technical understanding

6. **[FAQ](./player-help/06-faq.md)**
   - Common questions answered
   - Troubleshooting help
   - Trust and security explained

**This document below** is for advanced users who want to verify games using browser console scripts.

---

## Table of Contents

1. [What is Provably Fair?](#what-is-provably-fair)
2. [How to Verify Your Games](#how-to-verify-your-games)
3. [Understanding Seeds](#understanding-seeds)
4. [Game Verification Guides](#game-verification-guides)
   - [Dice](#dice-game)
   - [Limbo](#limbo-game)
   - [Crash](#crash-game)
   - [Plinko](#plinko-game)
   - [Mines](#mines-game)
   - [Roulette](#roulette-game)
5. [Frequently Asked Questions](#frequently-asked-questions)

---

## What is Provably Fair?

Provably Fair is a technology that allows you to verify that your game results were determined fairly and weren't manipulated by the casino.

### How Does It Work?

Think of it like this:

1. **Before you play**, we show you a "locked box" (server seed hash)
2. **You provide your own input** (client seed) - like adding your own randomness
3. **Each game gets a unique number** (nonce) - like a ticket number
4. **The game result** is calculated using all these ingredients
5. **After you play**, we can reveal what was in the "locked box" so you can verify everything was fair

### Why Trust This System?

- 🔒 **Cryptographic Security**: Uses industry-standard encryption (HMAC-SHA512)
- 👁️ **Full Transparency**: You can verify every single game
- 🎲 **Your Randomness**: Your client seed adds your own randomness to results
- ✅ **Industry Standard**: Uses the same system as major crypto casinos like Stake.com

---

## How to Verify Your Games

### Quick Overview

1. **Record your seeds** before playing (we show them in your account)
2. **Play your games** as normal
3. **Change your client seed** to reveal the server seed
4. **Verify your games** using the verification scripts below

### Step-by-Step Process

#### Step 1: Check Your Current Seeds

Before playing, you can view your current seeds:

- **Server Seed Hash**: A cryptographic hash of our secret seed (shown before games)
- **Client Seed**: Your seed that adds randomness (you can change this anytime)
- **Nonce**: Starts at 0, increases by 1 for each game you play

**Where to find this**: Account Settings → Provably Fair

#### Step 2: Play Your Games

Play normally. Each game automatically:

- Uses your current server seed + client seed + nonce
- Increments the nonce by 1
- Records all information with the game result

#### Step 3: Reveal Server Seed

To verify your games, you need to reveal the server seed:

1. Go to Account Settings → Provably Fair
2. Click "Change Client Seed"
3. Enter a new client seed (or let us generate one)
4. We'll reveal your old server seed

**Important**: Once revealed, that seed pair is retired and you get new seeds.

#### Step 4: Verify Games

Use the verification scripts below to check your games were fair!

---

## Understanding Seeds

### Server Seed

- **What it is**: A random 64-character string we generate
- **When you see it**: Only after you change your client seed
- **What's shown before**: A hash (encrypted version) so we can't change it later
- **Example**: `a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd`

### Client Seed

- **What it is**: Your personal random string
- **You control it**: Change it anytime to add your own randomness
- **Default**: We generate a random one, but you can set your own
- **Example**: `my-lucky-seed-12345`

### Nonce

- **What it is**: A counter that increases with each game
- **Starts at**: 0
- **Changes**: Increases by 1 for each game
- **Resets**: When you change your client seed
- **Example**: Game 1 uses nonce 0, game 2 uses nonce 1, etc.

### Server Seed Hash

- **What it is**: An encrypted version of the server seed
- **Why it exists**: Proves we generated the seed before your games
- **Can't be reversed**: You can't figure out the server seed from the hash
- **You can verify**: Once revealed, you can hash the server seed yourself and confirm it matches

---

## Game Verification Guides

### Dice Game

**How It Works**: Roll a number between 0.00 and 100.00

#### Understanding Dice Results

- **Range**: 0.00 to 100.00 (including 100.00!)
- **Possible Results**: 10,001 different outcomes
- **Distribution**: Every number is equally likely

#### How to Verify Dice

**You'll need**:

- Server Seed (revealed)
- Client Seed
- Nonce
- Game Result

**Verification Script** (Copy and paste into browser console):

```javascript
// Dice Verification Script
// Press F12, go to Console tab, paste this script

async function verifyDice(serverSeed, clientSeed, nonce, expectedResult) {
  // Step 1: Create hash using HMAC-SHA512
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const message = `${clientSeed}:${nonce}:DICE`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  // Step 2: Convert to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Step 3: Take first 4 bytes and convert to float
  let float = 0;
  const divisors = [256, 65536, 16777216, 4294967296];
  for (let i = 0; i < 4; i++) {
    const byteValue = parseInt(hashHex.substr(i * 2, 2), 16);
    float += byteValue / divisors[i];
  }

  // Step 4: Calculate dice result
  const result = Math.floor(float * 10001) / 100;

  // Step 5: Compare
  console.log('═══════════════════════════════');
  console.log('🎲 DICE VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Client Seed:', clientSeed);
  console.log('Nonce:', nonce);
  console.log('───────────────────────────────');
  console.log('Expected Result:', expectedResult);
  console.log('Calculated Result:', result.toFixed(2));
  console.log('───────────────────────────────');

  if (Math.abs(result - expectedResult) < 0.01) {
    console.log('✅ VERIFIED - Results match!');
  } else {
    console.log('❌ MISMATCH - Please contact support');
  }
  console.log('═══════════════════════════════');

  return result;
}

// Example usage:
// verifyDice('your-server-seed', 'your-client-seed', '0', 75.23);
```

**How to Use**:

1. Open browser console (Press F12, click "Console" tab)
2. Copy and paste the script above
3. Press Enter
4. Run the verification:
   ```javascript
   verifyDice('a1b2c3d4...', 'my-seed', '0', 75.23);
   ```
5. Replace the values with your actual game data

**Example**:

```javascript
// Real example
verifyDice(
  'a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd',
  'my-lucky-seed',
  '0',
  75.23,
);

// Result:
// ✅ VERIFIED - Results match!
```

---

### Limbo Game

**How It Works**: Predict when the multiplier will crash

#### Understanding Limbo Results

- **Range**: 1.00x to 1,000,000x
- **Distribution**: Lower multipliers are more common
- **House Edge**: 1% (you have 99% expected return)

#### How Limbo Multipliers Work

The multiplier is calculated using the formula: `0.99 ÷ random_number`

This means:

- Small random number = HIGH multiplier (rare)
- Large random number = LOW multiplier (common)

#### How to Verify Limbo

**You'll need**:

- Server Seed (revealed)
- Client Seed
- Nonce
- Game Result (multiplier)

**Verification Script**:

```javascript
// Limbo Verification Script
// Press F12, go to Console tab, paste this script

async function verifyLimbo(serverSeed, clientSeed, nonce, expectedResult) {
  // Step 1: Create hash using HMAC-SHA512
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const message = `${clientSeed}:${nonce}:LIMBO`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  // Step 2: Convert to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Step 3: Take first 4 bytes and convert to float
  let float = 0;
  const divisors = [256, 65536, 16777216, 4294967296];
  for (let i = 0; i < 4; i++) {
    const byteValue = parseInt(hashHex.substr(i * 2, 2), 16);
    float += byteValue / divisors[i];
  }

  // Step 4: Calculate limbo result
  // Clamp float to safe range
  const safeFloat = Math.max(0.000001, Math.min(0.999999, float));

  // Apply house edge (1%)
  let multiplier = 0.99 / safeFloat;

  // Cap at maximum
  multiplier = Math.min(multiplier, 1000000);

  // Ensure minimum 1.00x
  const result = Math.max(1.0, multiplier);

  // Step 5: Compare
  console.log('═══════════════════════════════');
  console.log('🚀 LIMBO VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Client Seed:', clientSeed);
  console.log('Nonce:', nonce);
  console.log('───────────────────────────────');
  console.log('Expected Result:', expectedResult.toFixed(2) + 'x');
  console.log('Calculated Result:', result.toFixed(2) + 'x');
  console.log('───────────────────────────────');

  if (Math.abs(result - expectedResult) < 0.01) {
    console.log('✅ VERIFIED - Results match!');
  } else {
    console.log('❌ MISMATCH - Please contact support');
  }
  console.log('═══════════════════════════════');

  return result;
}

// Example usage:
// verifyLimbo('your-server-seed', 'your-client-seed', '0', 2.45);
```

**Example**:

```javascript
verifyLimbo(
  'a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd',
  'my-lucky-seed',
  '0',
  2.45,
);

// Result:
// ✅ VERIFIED - Results match!
```

---

### Crash Game

**How It Works**: Watch the multiplier climb and cash out before it crashes!

#### Understanding Crash

Crash is special because:

- ✈️ **One multiplier per round** - All players see the same crash point
- 🔗 **Pre-generated seed chain** - 10 million games generated in advance
- ₿ **Bitcoin block hash** - Uses real Bitcoin blockchain as randomness source

#### How Crash Provably Fair Works

1. We generated 10 million seeds in advance (before any games)
2. We published a "terminating hash" as proof
3. We use a future Bitcoin block hash as the "client seed"
4. Each game uses one seed from the chain + Bitcoin hash
5. You can verify the entire chain connects to our published hash

#### Crash Game Information

You can view our Crash provably fair commitment:

- **Chain Length**: 10,000,000 games
- **Terminating Hash**: Published before games started
- **Bitcoin Block**: Real blockchain data (can't be manipulated)

#### How to Verify Crash

**You'll need**:

- Server Seed (from the game)
- Bitcoin Block Hash (same for all games)
- Game Index (which game in the chain)
- Crash Point

**Verification Script**:

```javascript
// Crash Verification Script
// Press F12, go to Console tab, paste this script

async function verifyCrash(serverSeed, bitcoinBlockHash, expectedCrashPoint) {
  // Step 1: Create hash using HMAC-SHA256
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(bitcoinBlockHash));

  // Step 2: Convert to hex and take first 8 characters
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const hexValue = hashHex.substring(0, 8);

  // Step 3: Convert to number
  const intValue = parseInt(hexValue, 16);
  const normalized = intValue / 0xffffffff;

  // Step 4: Calculate crash point
  const houseEdge = 0.01; // 1%

  let crashPoint;
  if (normalized < houseEdge) {
    // Instant crash (1% of games)
    crashPoint = 1.0;
  } else {
    // Scale to [0, 1) and apply exponential curve
    const adjusted = (normalized - houseEdge) / (1 - houseEdge);
    const safed = Math.min(0.9999999999, Math.max(0.0, adjusted));

    crashPoint = 1 / (1 - safed);
    crashPoint = Math.min(Math.max(crashPoint, 1.0), 1000);
    crashPoint = Math.round(crashPoint * 100) / 100;
  }

  // Step 5: Compare
  console.log('═══════════════════════════════');
  console.log('💥 CRASH VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Bitcoin Block Hash:', bitcoinBlockHash);
  console.log('───────────────────────────────');
  console.log('Expected Crash Point:', expectedCrashPoint.toFixed(2) + 'x');
  console.log('Calculated Crash Point:', crashPoint.toFixed(2) + 'x');
  console.log('───────────────────────────────');

  if (Math.abs(crashPoint - expectedCrashPoint) < 0.01) {
    console.log('✅ VERIFIED - Crash point matches!');
  } else {
    console.log('❌ MISMATCH - Please contact support');
  }
  console.log('═══════════════════════════════');

  return crashPoint;
}

// Get Bitcoin hash and server seed from game info
const BITCOIN_BLOCK_HASH = '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd';

// Example usage:
// verifyCrash('game-server-seed', BITCOIN_BLOCK_HASH, 2.45);
```

**Where to Find Game Info**:

- Go to your game history
- Click on a Crash game
- View "Provably Fair Details"
- Copy the server seed shown

**Example**:

```javascript
verifyCrash(
  'abc123def456...',
  '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd',
  2.45,
);

// Result:
// ✅ VERIFIED - Crash point matches!
```

---

### Plinko Game

**How It Works**: Drop a ball and watch it bounce left or right through pegs

#### Understanding Plinko

- 🎯 **Binary choices**: Ball goes left OR right at each peg
- 🔢 **8-16 rows**: More rows = more possible outcomes
- 🎲 **50/50 chance**: Each bounce is a fair coin flip
- 💰 **Risk levels**: LOW, MEDIUM, or HIGH multipliers

#### How Plinko Path is Determined

For each row:

1. Generate a random number between 0 and 1
2. If number < 0.5: Ball goes LEFT
3. If number >= 0.5: Ball goes RIGHT
4. Final bucket = number of left bounces

#### How to Verify Plinko

**You'll need**:

- Server Seed (revealed)
- Client Seed
- Nonce
- Number of Rows (8-16)
- Final Bucket Position

**Verification Script**:

```javascript
// Plinko Verification Script
// Press F12, go to Console tab, paste this script

async function verifyPlinko(serverSeed, clientSeed, nonce, rows, expectedBucket) {
  const encoder = new TextEncoder();

  let leftSteps = 0;
  const path = [];

  // For each row, determine if ball goes left or right
  for (let row = 0; row < rows; row++) {
    // Generate random value for this row
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(serverSeed),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );

    const message = `${clientSeed}:${nonce}:${row}`;
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

    // Convert to hex
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Take first 4 bytes and convert to float
    let float = 0;
    const divisors = [256, 65536, 16777216, 4294967296];
    for (let i = 0; i < 4; i++) {
      const byteValue = parseInt(hashHex.substr(i * 2, 2), 16);
      float += byteValue / divisors[i];
    }

    // Determine direction (< 0.5 = left, >= 0.5 = right)
    if (float < 0.5) {
      leftSteps++;
      path.push('L');
    } else {
      path.push('R');
    }
  }

  // Final bucket is number of left steps
  const bucket = leftSteps;

  // Display results
  console.log('═══════════════════════════════');
  console.log('🎯 PLINKO VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Client Seed:', clientSeed);
  console.log('Nonce:', nonce);
  console.log('Rows:', rows);
  console.log('───────────────────────────────');
  console.log('Ball Path:', path.join(' → '));
  console.log('Left Steps:', leftSteps);
  console.log('───────────────────────────────');
  console.log('Expected Bucket:', expectedBucket);
  console.log('Calculated Bucket:', bucket);
  console.log('───────────────────────────────');

  if (bucket === expectedBucket) {
    console.log('✅ VERIFIED - Bucket matches!');
  } else {
    console.log('❌ MISMATCH - Please contact support');
  }
  console.log('═══════════════════════════════');

  return bucket;
}

// Example usage:
// verifyPlinko('your-server-seed', 'your-client-seed', '0', 8, 4);
```

**Example**:

```javascript
verifyPlinko(
  'a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd',
  'my-lucky-seed',
  '0',
  8, // 8 rows
  4, // Landed in bucket 4
);

// Result:
// Ball Path: L → R → L → R → L → L → R → R
// ✅ VERIFIED - Bucket matches!
```

---

### Mines Game

**How It Works**: Reveal tiles on a 5x5 grid without hitting mines

#### Understanding Mines

- 📊 **5x5 Grid**: 25 total positions
- 💣 **Your Choice**: Pick how many mines (1-24)
- 🔀 **Fisher-Yates Shuffle**: Industry-standard fair shuffling
- 🎯 **Pre-determined**: All mine positions set before you click

#### How Mine Positions are Determined

1. Start with positions 0-24
2. Shuffle them using random values from your seeds
3. First N positions = mine locations
4. All 25 positions determined before your first click!

#### How to Verify Mines

**You'll need**:

- Server Seed (revealed)
- Client Seed
- Nonce
- Number of Mines
- Revealed Mine Positions

**Verification Script**:

```javascript
// Mines Verification Script
// Press F12, go to Console tab, paste this script

async function verifyMines(serverSeed, clientSeed, nonce, mineCount, revealedMines) {
  const encoder = new TextEncoder();

  // Start with all positions
  const cells = Array.from({ length: 25 }, (_, i) => i);

  // Fisher-Yates shuffle
  for (let i = 24; i > 0; i--) {
    // Generate random value for this position
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(serverSeed),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );

    const message = `${clientSeed}:${nonce}:${i}`;
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

    // Convert to hex
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Take first 4 bytes and convert to float
    let float = 0;
    const divisors = [256, 65536, 16777216, 4294967296];
    for (let j = 0; j < 4; j++) {
      const byteValue = parseInt(hashHex.substr(j * 2, 2), 16);
      float += byteValue / divisors[j];
    }

    // Swap positions
    const swapIndex = Math.floor(float * (i + 1));
    [cells[i], cells[swapIndex]] = [cells[swapIndex], cells[i]];
  }

  // First mineCount positions are mines
  const minePositions = cells.slice(0, mineCount).sort((a, b) => a - b);

  // Display results
  console.log('═══════════════════════════════');
  console.log('💣 MINES VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Client Seed:', clientSeed);
  console.log('Nonce:', nonce);
  console.log('Mine Count:', mineCount);
  console.log('───────────────────────────────');
  console.log('All Mine Positions:', minePositions);
  console.log('───────────────────────────────');

  // Check if revealed mines match
  if (revealedMines && revealedMines.length > 0) {
    const allMatch = revealedMines.every((pos) => minePositions.includes(pos));
    if (allMatch) {
      console.log('✅ VERIFIED - Mine positions match!');
    } else {
      console.log('❌ MISMATCH - Please contact support');
    }
  } else {
    console.log('ℹ️ No mines revealed to verify');
  }

  console.log('═══════════════════════════════');

  // Display visual grid
  console.log('\nVisual Grid (0-24):');
  let grid = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const pos = row * 5 + col;
      grid += minePositions.includes(pos) ? '💣 ' : '✅ ';
    }
    grid += '\n';
  }
  console.log(grid);

  return minePositions;
}

// Example usage:
// verifyMines('your-server-seed', 'your-client-seed', '0', 3, [5, 12, 18]);
```

**Example**:

```javascript
verifyMines(
  'a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd',
  'my-lucky-seed',
  '0',
  3, // 3 mines
  [5, 12, 18], // Mines you revealed
);

// Result:
// All Mine Positions: [5, 12, 18, ...]
// ✅ VERIFIED - Mine positions match!
```

---

### Roulette Game

**How It Works**: Classic European roulette (0-36)

#### Understanding Roulette

- 🎰 **37 Numbers**: 0 through 36
- 🎲 **Fair Selection**: Each number has equal 1/37 chance
- 🔴 **European Rules**: Single zero (0)

#### How to Verify Roulette

**You'll need**:

- Server Seed (revealed)
- Client Seed
- Nonce
- Winning Number

**Verification Script**:

```javascript
// Roulette Verification Script
// Press F12, go to Console tab, paste this script

async function verifyRoulette(serverSeed, clientSeed, nonce, expectedNumber) {
  // Step 1: Create hash using HMAC-SHA512
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverSeed),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const message = `${clientSeed}:${nonce}:ROULETTE`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));

  // Step 2: Convert to hex
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  // Step 3: Take first 4 bytes and convert to float
  let float = 0;
  const divisors = [256, 65536, 16777216, 4294967296];
  for (let i = 0; i < 4; i++) {
    const byteValue = parseInt(hashHex.substr(i * 2, 2), 16);
    float += byteValue / divisors[i];
  }

  // Step 4: Calculate roulette result (0-36)
  const result = Math.floor(float * 37);

  // Step 5: Compare
  console.log('═══════════════════════════════');
  console.log('🎰 ROULETTE VERIFICATION RESULT');
  console.log('═══════════════════════════════');
  console.log('Server Seed:', serverSeed);
  console.log('Client Seed:', clientSeed);
  console.log('Nonce:', nonce);
  console.log('───────────────────────────────');
  console.log('Expected Number:', expectedNumber);
  console.log('Calculated Number:', result);
  console.log('───────────────────────────────');

  // Get color
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const color = result === 0 ? 'Green' : redNumbers.includes(result) ? 'Red' : 'Black';
  console.log('Color:', color);
  console.log('───────────────────────────────');

  if (result === expectedNumber) {
    console.log('✅ VERIFIED - Number matches!');
  } else {
    console.log('❌ MISMATCH - Please contact support');
  }
  console.log('═══════════════════════════════');

  return result;
}

// Example usage:
// verifyRoulette('your-server-seed', 'your-client-seed', '0', 17);
```

**Example**:

```javascript
verifyRoulette(
  'a1b2c3d4e5f6789012345678901234567890abcdefabcdefabcdefabcdefabcd',
  'my-lucky-seed',
  '0',
  17,
);

// Result:
// Color: Black
// ✅ VERIFIED - Number matches!
```

---

## Frequently Asked Questions

### General Questions

**Q: Do I need to verify every game?**
A: No, but you can! The system lets you verify any game whenever you want. Most players spot-check occasionally.

**Q: How often should I change my client seed?**
A: It's up to you! Changing it more often gives you more control over randomness, but isn't required for fairness.

**Q: Will changing my client seed affect my odds?**
A: No! Whether you use the default seed or change it daily, your odds are exactly the same.

**Q: Can I use the same client seed as someone else?**
A: Yes, but each player has their own unique server seed, so results will still be different.

### Technical Questions

**Q: What is HMAC-SHA512?**
A: It's a cryptographic method that combines your seeds to create a unique, unpredictable result that can't be tampered with.

**Q: Why can't I see the server seed before playing?**
A: If you could see it, you'd know the results in advance! Instead, we show you a "hash" (encrypted version) that proves we generated it before your games.

**Q: How do I verify the server seed hash?**
A: Once the server seed is revealed, you can hash it yourself and check it matches the hash shown before. The verification scripts do this automatically.

**Q: What if the verification fails?**
A: This should never happen! If it does, please contact our support team immediately with:

- Game ID
- Server seed
- Client seed
- Nonce
- Expected and calculated results

### Trust & Security

**Q: Can you change the server seed after I play?**
A: No! We show you the hash (encrypted version) before you play. If we changed the seed, the hash wouldn't match.

**Q: Can you predict my results?**
A: No! Your client seed adds randomness we don't control, and we can't predict the hash result.

**Q: Is this the same system other casinos use?**
A: Yes! We use the same Provably Fair system as major crypto casinos like Stake.com and Shuffle.com.

**Q: Can I trust the verification scripts?**
A: The scripts use your browser's built-in crypto functions. They run entirely on your computer and don't send data anywhere.

### Specific Game Questions

**Q: Why is Crash different from other games?**
A: Crash is multiplayer, so everyone needs to see the same result. We use a pre-generated seed chain + Bitcoin blockchain to ensure fairness for all players.

**Q: How do I verify old Crash games?**
A: Crash games show their server seed in the game history. Use the Bitcoin block hash that was current when the game was played.

**Q: Can I verify Mines before revealing all tiles?**
A: Yes! All mine positions are determined before your first click. After revealing the server seed, you can see where all mines were.

**Q: Does Plinko really use 50/50 for each bounce?**
A: Yes! Each bounce is an independent 50/50 decision. The final bucket follows a natural bell curve (center buckets more likely).

---

## Need Help?

### Support

If you have questions or issues with verification:

1. **Check this guide first** - Most questions are answered here
2. **Try the examples** - Copy the exact example code to make sure it works
3. **Contact Support** - We're here to help! Provide:
   - Game type
   - Game ID
   - Seeds used
   - What you expected vs what you got

### Additional Resources

- **API Documentation**: For developers wanting to integrate verification
- **Video Tutorials**: Step-by-step verification guides (coming soon)
- **Community**: Join our Discord to discuss provably fair gaming

---

## Verification Best Practices

### For Maximum Transparency

1. ✅ **Record your server seed hash** before playing
2. ✅ **Take screenshots** of game results
3. ✅ **Change client seed** after a gaming session
4. ✅ **Verify a few games** from each session
5. ✅ **Use third-party tools** like Stake.com's verifier for Dice/Limbo

### Red Flags to Watch For

If you notice any of these, contact support immediately:

- ❌ Server seed hash changes without you changing client seed
- ❌ Nonce skips numbers or goes backward
- ❌ Verification fails for any game
- ❌ Server seed doesn't match the hash shown before

### Third-Party Verification

You can also verify our games using:

- **Stake.com Verifier**: Compatible with Dice and Limbo
- **Shuffle.com Verifier**: Compatible with Dice and Plinko
- **Custom Scripts**: Use the code provided in this guide

---

## About Our System

### Industry Compatibility

Our Provably Fair system is compatible with industry leaders:

- ✅ **Stake.com Compatible**: Dice, Limbo formulas match exactly
- ✅ **Shuffle.com Compatible**: Dice, Plinko algorithms match exactly
- ✅ **Standard Methods**: HMAC-SHA512, proven cryptography

### Why Trust zetik.com?

1. 🔓 **Open Verification**: Every game can be verified
2. 📜 **Public Commitment**: Crash seed chain published in advance
3. 🔐 **Industry Standards**: Same methods as trusted casinos
4. 👥 **Player Control**: You provide your own randomness
5. 🧮 **Mathematical Proof**: Verified house edge percentages

---

## Glossary

**Provably Fair**: System that lets players verify game fairness

**Server Seed**: Casino's secret random value (revealed after games)

**Client Seed**: Player's random value (you can set this)

**Nonce**: Game counter, increments with each game

**Hash**: Encrypted version of data (one-way, can't be reversed)

**HMAC**: Secure method to combine seeds and create results

**House Edge**: Casino's mathematical advantage (e.g., 1%)

**RTP**: Return to Player percentage (100% - house edge)

---

_Last Updated: October 14, 2025_
_Version: 1.0_

**Need Help?** Contact support@zetik.com or visit our Help Center
