# Provably Fair - Commitment Schemes

A **commitment scheme** is the foundation of provably fair gaming. Think of it like a sealed envelope that proves we generated a result before you played, without revealing what's inside until later.

---

## The Simple Explanation

Imagine we're playing a guessing game:

### Without Commitment (Not Fair)

1. You guess a number: 7
2. I say: "The answer is... 8! You lose!"
3. **Problem:** You can't prove I didn't just pick 8 after seeing your guess

### With Commitment (Fair!)

1. I write "8" on paper, seal it in an envelope, show you the sealed envelope
2. You guess a number: 7
3. I open the envelope, prove the answer was always 8
4. **Result:** You know I couldn't change my answer!

**This is exactly how provably fair works** - but with cryptography instead of envelopes!

---

## The Three Components

Every game result uses three ingredients that work together:

### 1. 🔒 Server Seed (Our Commitment)

**What It Is:**

- A random 64-character string we generate
- Example: `a1b2c3d4e5f6789012345678901234567890abcdef...`

**The Hash (Sealed Envelope):**

- Before you play, we show you a **server seed hash**
- This is like the sealed envelope
- Created using SHA-256 encryption
- Example hash: `3f39d5c...` (much shorter)

**Why It Works:**

- The hash proves we generated the seed beforehand
- Impossible to create the same hash from a different seed
- Impossible to figure out the seed from just the hash
- When revealed, you can verify it matches the hash

**Analogy:**

```
Server Seed = Message in envelope
Server Hash = Sealed envelope (you see this first)
Reveal      = Opening envelope (after your games)
```

### 2. 🎲 Client Seed (Your Randomness)

**What It Is:**

- Your personal random string
- Can be anything you want!
- Example: `my-lucky-phrase-2024`

**How It Works:**

- Initially auto-generated as random characters
- You can change it to any text you prefer
- Gets combined with our server seed
- Adds your own unpredictability to results

**Why It Matters:**

- Even if we wanted to cheat (we don't!), we can't predict your seed
- You control part of the randomness
- Makes results truly unpredictable by both parties

**Analogy:**

```
We flip a coin → Heads
You flip a coin → Tails
Combined result → Heads + Tails = Unpredictable!
```

### 3. 🎫 Nonce (Game Counter)

**What It Is:**

- A simple counter: 0, 1, 2, 3, 4...
- Starts at 0 when seeds are created
- Increases by 1 for each game

**Why It's Needed:**

- Makes every game unique
- Same seeds + different nonce = different results
- Ensures no two games can have identical outcomes

**Example:**

```
Game 1: Server + Client + Nonce 0 = Result A
Game 2: Server + Client + Nonce 1 = Result B
Game 3: Server + Client + Nonce 2 = Result C
```

**Analogy:**

```
Seeds = Deck of cards
Nonce = Which card you're drawing (1st, 2nd, 3rd...)
```

---

## How They Work Together

### The Formula

```
Game Result = HMAC-SHA512(
  Server Seed + Client Seed + Nonce + Game Type
)
```

**What This Means:**

- All three ingredients are mixed together
- Using HMAC-SHA512 cryptographic function
- Produces a unique, unpredictable result
- Same ingredients always produce same result (verifiable!)
- Changing any ingredient completely changes result

### Visual Flow

```
┌─────────────────────────────────────────────┐
│                                             │
│  🔒 Server Seed (secret)                    │
│  +                                          │
│  🎲 Client Seed (your input)                │
│  +                                          │
│  🎫 Nonce (game counter)                    │
│  ↓                                          │
│  🔐 HMAC-SHA512 Function                    │
│  ↓                                          │
│  🎮 Game Result                             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## The Two-Phase Process

### Phase 1: Commit (Before Games)

**What Happens:**

1. We generate a random server seed
2. We create a hash of it (the "sealed envelope")
3. We show you the hash
4. You set your client seed
5. Nonce starts at 0

**Why This Matters:**

- The hash is our **commitment**
- We can't change the server seed now
- The hash proves what it was
- Everything is locked in before you play

**Example:**

```
Server Seed: a1b2c3d4e5f6... (hidden from you)
Server Hash: 3f39d5c847b2... (shown to you)
Client Seed: my-lucky-seed (your choice)
Nonce: 0
```

### Phase 2: Reveal (After Games)

**What Happens:**

1. You play your games (nonce increases each game)
2. You change your client seed (triggers reveal)
3. We show you the original server seed
4. You verify it matches the hash
5. You verify your game results

**Why This Matters:**

- Now you can see the server seed
- You can verify it matches the original hash
- You can recalculate all your game results
- Everything is transparent and verifiable

**Example:**

```
Server Seed: a1b2c3d4e5f6... (NOW REVEALED!)
Hash Check: SHA256(server seed) = 3f39d5c847b2... ✅
Games: Verify using revealed seed + your seed + nonces
```

---

## Why Each Component Matters

### Without Server Seed

**Problem:** Casino could generate results after seeing your bet

```
❌ You bet on 7
❌ Casino generates 8 (you lose)
❌ No way to prove they didn't cheat
```

**Solution:** Server seed committed beforehand

```
✅ Casino commits to seed (shows hash)
✅ You bet on 7
✅ Result determined by pre-committed seed
✅ Casino can't change it!
```

### Without Client Seed

**Problem:** Casino knows the server seed, might predict results

```
❌ Casino knows seed = knows all outcomes
❌ Could manipulate when you play
❌ Not truly random for you
```

**Solution:** Your client seed adds randomness

```
✅ You control your seed
✅ Casino can't predict combined result
✅ True randomness from both sides
```

### Without Nonce

**Problem:** Same seeds = same result every game

```
❌ Game 1 result: 75.23
❌ Game 2 result: 75.23 (same!)
❌ Game 3 result: 75.23 (same!)
```

**Solution:** Nonce makes each game unique

```
✅ Game 1 (nonce 0): 75.23
✅ Game 2 (nonce 1): 42.89
✅ Game 3 (nonce 2): 91.55
```

---

## Understanding Cryptographic Hashing

### What Is SHA-256?

SHA-256 is like a **fingerprint machine for data**:

**Properties:**

- ✅ Same input always gives same fingerprint
- ✅ Impossible to reverse (fingerprint → original)
- ✅ Tiny change = completely different fingerprint
- ✅ No two different inputs have same fingerprint

**Example:**

```
Input: "hello"
Hash:  2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

Input: "hello!"  (just added !)
Hash:  ce06092fb948d9ffac7d1a376e404b26b7575bcc11ee05a4615fef4fec3a308b
      ↑ Completely different!
```

### What Is HMAC-SHA512?

HMAC is like SHA but with a **secret key**:

**How It Works:**

- Uses SHA-512 (even more secure than SHA-256)
- Adds a secret key (our server seed)
- Combines with your data (client seed + nonce)
- Produces unpredictable result

**Why It's Secure:**

- Can't reverse engineer the inputs
- Can't predict outputs
- Used by banks, governments, military
- Battle-tested for decades

---

## Real-World Example

Let's walk through a complete game:

### Setup (Before Any Games)

```
1. Casino generates:
   Server Seed: "a1b2c3d4e5f6789012345678901234567890abcdef..."

2. Casino creates hash:
   Server Hash: SHA256(server seed) = "3f39d5c847b2..."

3. You see in your account:
   Server Hash: 3f39d5c847b2... ← Only the hash!
   Client Seed: "my-lucky-seed"
   Nonce: 0
```

### Playing Games

```
Game 1 (Dice):
  Inputs: server seed + "my-lucky-seed" + 0 + "DICE"
  HMAC-SHA512 result: "a4f29c3b..."
  Convert to number: 75.23
  Your roll: 75.23 ✅

Game 2 (Dice):
  Inputs: server seed + "my-lucky-seed" + 1 + "DICE"
  HMAC-SHA512 result: "b7e82d9f..."
  Convert to number: 42.15
  Your roll: 42.15 ✅
```

### Verification (After Changing Client Seed)

```
1. You change client seed to "new-seed"

2. Casino reveals old server seed:
   Server Seed: "a1b2c3d4e5f6789012345678901234567890abcdef..."

3. You verify the hash:
   SHA256("a1b2c3d4e5f6...") = "3f39d5c847b2..." ✅
   Matches the hash shown before! ✅

4. You verify Game 1:
   HMAC-SHA512("a1b2c3d4..." + "my-lucky-seed" + 0 + "DICE")
   Result: 75.23 ✅
   Matches your actual roll! ✅
```

---

## Common Questions

### Why show the hash instead of the server seed?

If we showed the server seed before you played:

- You could calculate all results in advance
- You'd only play when you were going to win
- The system wouldn't work!

The hash proves we generated it without revealing what it is.

### Can't you just pick a seed that makes me lose?

No! Because:

- You add your client seed (we don't control it)
- You can change your client seed anytime
- Combined randomness is unpredictable to us

### What if you generate millions of seeds and pick one where I lose?

That's why your **client seed** is crucial:

- We commit to server seed FIRST (show hash)
- Then you set/change your client seed
- We can't predict the combined result
- Changing your seed completely changes all outcomes

### Why not just use truly random results?

We do! But:

- Provably fair makes it **verifiable**
- You can prove we didn't cheat
- Pure randomness has no accountability
- This system has both randomness AND proof

---

## Security Guarantees

### What the Hash Proves

✅ **We generated the server seed before your games**

- Hash shown first
- Seed revealed later
- If seed changes, hash won't match

✅ **We can't change the server seed**

- Cryptographically impossible to find another seed with same hash
- Would take billions of years with all computers on Earth

✅ **Results are deterministic**

- Same inputs always produce same output
- You can verify by recalculating yourself

### What Your Client Seed Proves

✅ **You control part of the randomness**

- We can't predict what you'll choose
- Changing it changes all results

✅ **Results are unpredictable**

- Even if we knew our seed perfectly
- Your seed makes combined result unknown

### What the Nonce Proves

✅ **Each game is unique**

- No repeated results
- Sequential and verifiable
- Can't skip or reuse numbers

---

## Technical vs Simple Terms

| Technical         | Simple                    |
| ----------------- | ------------------------- |
| Commitment Scheme | Sealed envelope promise   |
| Server Seed       | Our secret random number  |
| Client Seed       | Your lucky phrase         |
| Nonce             | Game counter (0, 1, 2...) |
| Hash              | Encrypted fingerprint     |
| HMAC-SHA512       | Secure mixing function    |
| Reveal            | Opening the envelope      |
| Verification      | Checking the math         |

---

## Next Steps

Now that you understand commitment schemes:

- [How to Verify Bets](./02-how-to-verify-bets.md) - Start verifying your games
- [Technical Implementation](./05-implementation.md) - Deep dive into HMAC and byte conversion
- [Game Implementations](./04-game-implementations.md) - How each game uses seeds
- [FAQ](./06-faq.md) - Common questions answered

---

_Last Updated: October 14, 2025_
_Understanding provably fair gaming_
