# Provably Fair - Overview

**What is Provably Fair?**

Provably Fair is a technology that ensures game outcomes on zetik.com are:

- ✅ **Random** - No patterns or predictability
- ✅ **Fair** - Same odds for every player
- ✅ **Transparent** - You can verify any result
- ✅ **Tamper-Proof** - Cannot be manipulated by anyone

---

## How It Works

Every game result on zetik.com is determined by combining three things:

### 1. 🔒 Server Seed (Our Secret)

- A random value we generate
- Kept secret until you verify
- Shown as a "hash" before games (encrypted version)

### 2. 🎲 Client Seed (Your Input)

- Your personal random value
- You can change it anytime
- Adds your own randomness to results

### 3. 🎫 Nonce (Game Counter)

- Starts at 0
- Increases by 1 for each game
- Makes every game unique

---

## The Formula

```
Game Result = Cryptographic Function(Server Seed + Client Seed + Nonce)
```

This mathematical formula ensures:

- We can't predict or change results after showing you the hash
- You add your own randomness through your client seed
- Every game is unique and verifiable

---

## Why Trust This System?

### 🔐 Cryptographic Security

We use **HMAC-SHA512**, a military-grade encryption standard that:

- Creates unpredictable results
- Cannot be reversed or manipulated
- Is used by major banks and governments

### 👁️ Full Transparency

- View your seeds anytime in your account
- Verify any game result whenever you want
- See the math behind every outcome

### 🎰 Industry Standard

- Same system used by Stake.com and Shuffle.com
- Trusted by millions of players worldwide
- Audited by independent security experts

---

## What This Means for You

### Before You Play

- ✅ We show you the server seed hash (encrypted)
- ✅ You can set your own client seed
- ✅ Everything is committed before the game

### While You Play

- ✅ Results are determined by the formula above
- ✅ We can't change the server seed (hash proves it)
- ✅ Each game uses a new nonce

### After You Play

- ✅ Change your client seed to reveal our server seed
- ✅ Verify any game using our verification tool
- ✅ Confirm the math matches your results

---

## The Guarantee

With Provably Fair:

- **We can't cheat** - The server seed is committed before your games
- **You can't be cheated** - You can verify every single result
- **Results are fair** - The odds are exactly as advertised
- **Everything is transparent** - No hidden algorithms or secrets

---

## Next Steps

Learn how to:

- [Verify Your Bets](./02-how-to-verify-bets.md) - Step-by-step verification guide
- [Understand Commitment Schemes](./03-commitment-schemes.md) - How seeds work together
- [Technical Implementation](./05-implementation.md) - Deep dive into the algorithms
- [Check Game Implementations](./04-game-implementations.md) - How each game generates results

---

**Questions?** Check our [FAQ](./06-faq.md) or contact support@zetik.com

_Last Updated: October 14, 2025_
