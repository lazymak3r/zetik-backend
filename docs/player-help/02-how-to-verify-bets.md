# Provably Fair - How to Verify Bets

Verifying your bets on zetik.com is easy! Follow these simple steps to confirm your game results were fair.

---

## Quick Overview

**Verification takes 3 simple steps:**

1. 🎮 Play your games normally
2. 🔄 Rotate your seed pair (reveals server seed)
3. ✅ Click "Verify" on any bet

**No technical knowledge needed!** Everything happens in your browser.

---

## Step-by-Step Verification

### Step 1: Play Your Games

Just play normally! The system automatically:

- Uses your current server seed (hidden) and client seed
- Increments the nonce for each game
- Records everything with your bet

**Your current seeds are visible in**: Account → Provably Fair Settings

---

### Step 2: Rotate Your Seed Pair

When you're ready to verify your bets:

#### How to Rotate Seeds

1. Go to **Account Settings**
2. Click **Provably Fair** tab
3. Click **"Change Client Seed"** button

#### What Happens Next

You'll see a popup asking for a new client seed:

**Option A: Auto-Generate** (Recommended)

- Click "Generate Random Seed"
- We create a new random seed for you

**Option B: Custom Seed**

- Enter your own lucky phrase
- Any text you want (e.g., "my-lucky-phrase-2024")

#### After You Submit

✅ **Old server seed is revealed** - You can now see what it was
✅ **New seed pair activated** - Ready for your next games
✅ **Previous bets ready to verify** - Use the revealed server seed

**Important:** You can only see the server seed AFTER rotating. This proves we couldn't change it!

---

### Step 3: Verify a Bet

#### Open a Bet for Verification

1. Go to **Bet History**
2. Find the bet you want to verify
3. Click on the bet to open details
4. Click **"Verify Bet"** button

#### What You'll See

The verification screen shows:

**Bet Information:**

- Game type (Dice, Limbo, Crash, etc.)
- Bet amount and result
- Timestamp

**Seed Information:**

- ✅ Server Seed (revealed after rotation)
- ✅ Client Seed (your seed when you played)
- ✅ Nonce (game number)
- ✅ Server Seed Hash (commitment shown before game)

#### Automatic Verification

Click **"Verify Now"** and our system:

1. ✅ Takes your server seed, client seed, and nonce
2. ✅ Runs the same formula used for your original game
3. ✅ Compares the calculated result with your actual result
4. ✅ Shows you if they match!

#### Verification Results

You'll see one of these messages:

**✅ Verified Successfully**

```
Game result verified! The outcome matches the
cryptographic calculation using your seeds.

Original Result: 75.23
Verified Result: 75.23
Status: ✅ Match
```

**❌ Verification Failed** (This should NEVER happen!)

```
Verification mismatch detected. Please contact
support immediately with your bet ID.

Original Result: 75.23
Verified Result: 50.12
Status: ❌ Mismatch
```

---

## Understanding Verification Status

### When Seeds Are Active

While you're playing with a seed pair:

- 🔒 **Server seed is hidden** (you see only the hash)
- 🔓 **Client seed is visible** (you can change it anytime)
- 📊 **Bets show "Pending Verification"** (server seed not revealed yet)

### After Rotating Seeds

Once you change your client seed:

- 🔓 **Old server seed revealed** (now you can verify!)
- ✅ **All previous bets ready to verify**
- 📊 **Bets show "Ready to Verify"**

---

## Tips for Best Verification

### ✅ Do This

**Regular Rotation**

- Rotate seeds every few gaming sessions
- More rotations = more verification opportunities

**Spot Check Verification**

- You don't need to verify every bet
- Verify a few random bets each time
- Proves the system is working correctly

**Keep Records** (Optional)

- Screenshot your server seed hash before playing
- Compare with revealed seed after rotation
- Extra proof that nothing changed

### ❌ Avoid This

**Rotating Too Quickly**

- Wait until you've played several games
- Each rotation reveals the previous seed
- More games = more to verify at once

**Never Losing Your Data**

- We keep all seed history in your account
- No need to manually save anything
- Just log in and verify anytime

---

## Verification Examples

### Example 1: Dice Game

**Your Bet:**

- Rolled: 75.23
- Bet: Over 50
- Won: Yes

**Verification:**

```
Server Seed: a1b2c3d4e5f6...
Client Seed: my-lucky-seed
Nonce: 42

Calculated Result: 75.23
Original Result: 75.23

✅ Verified - Results match perfectly!
```

### Example 2: Limbo Game

**Your Bet:**

- Multiplier: 2.45x
- Target: 2.00x
- Won: Yes

**Verification:**

```
Server Seed: abc123def456...
Client Seed: player-seed-789
Nonce: 15

Calculated Multiplier: 2.45x
Original Multiplier: 2.45x

✅ Verified - Results match perfectly!
```

---

## Frequently Asked Questions

### Do I have to verify every bet?

No! The system is designed so that verifying ANY bets proves the entire system works. Most players verify a few random bets occasionally.

### When should I rotate my seeds?

Anytime you want! Common times:

- After a gaming session
- Once a week
- When you want to verify recent bets
- If you're curious about the server seed

### Will rotating affect my odds?

No! Your odds are the same whether you:

- Never rotate seeds
- Rotate daily
- Use custom or auto-generated seeds

The math guarantees fairness regardless of seeds used.

### What if I rotate before verifying?

No problem! All your bet history stays in your account forever. You can verify bets from any previous seed pair anytime.

### Can I verify bets from months ago?

Yes! Your complete bet history and all revealed seeds stay in your account. Verify anytime.

### What if verification fails?

This should NEVER happen! If it does:

1. Take a screenshot
2. Note the Bet ID
3. Contact support immediately
4. We'll investigate thoroughly

---

## Advanced Verification

Want to verify independently without our tool?

### Manual Verification

You can verify using the same formula yourself:

1. Get your server seed, client seed, and nonce
2. Use our [verification calculator tool](https://zetik.com/verify)
3. Or use third-party verifiers like Stake.com's tool

### API Verification

Developers can verify programmatically:

- See our [API Documentation](../PROVABLY_FAIR_SYSTEM.md)
- Use our public verification endpoint
- Build your own verification tools

---

## Building Trust Through Verification

### What Verification Proves

When you verify bets:

- ✅ The server seed wasn't changed after your games
- ✅ The outcome formula works exactly as documented
- ✅ Your results match the cryptographic calculation
- ✅ The system is fair and transparent

### Why This Matters

- 🔐 **You're in control** - Verify whenever you want
- 👁️ **Full transparency** - No hidden algorithms
- 🎯 **Proven fairness** - Math doesn't lie
- 💪 **Peace of mind** - Play with confidence

---

## Need Help?

### Common Issues

**Can't find verified bets?**

- Make sure you rotated your seeds first
- Check "Bet History" → Filter by "Ready to Verify"

**Verification button not showing?**

- Rotate your seeds to reveal the server seed
- Server seed must be revealed to verify

**Want to verify old bets?**

- All history is saved permanently
- Just navigate to bet history and verify

### Contact Support

If you have questions:

- 💬 Live Chat: Click the chat icon
- 📧 Email: support@zetik.com
- 🎫 Support Ticket: Account → Support

---

## Next Steps

Learn more about provably fair:

- [Overview](./01-provably-fair-overview.md) - Understand the basics
- [Commitment Schemes](./03-commitment-schemes.md) - How seeds work
- [Game Implementations](./04-game-implementations.md) - How each game works

---

_Last Updated: October 14, 2025_
_For the most transparent gaming experience_
