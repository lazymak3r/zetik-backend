# Provably Fair - Frequently Asked Questions

Common questions about zetik.com's provably fair system, answered in simple terms.

---

## Basic Concepts

### What is provably fair?

Provably fair is a technology that lets you verify that game outcomes are:

- **Random** - Generated using cryptography
- **Fair** - Not manipulated by anyone
- **Transparent** - You can check the math yourself

Think of it like a sealed envelope system: we write down the result, seal it, show you the sealed envelope, you add your input, then we open it to prove nothing changed.

### Do I need to understand cryptography to use this?

**No!** You can:

- Play normally without thinking about it
- Click "Verify" button when you want to check
- Trust the system does the verification for you

Understanding the details is optional - the system works whether you verify or not.

### How is this better than traditional online casinos?

**Traditional casinos:**

- ❌ You trust them to be fair
- ❌ No way to verify results
- ❌ Could manipulate outcomes (you'd never know)

**Provably fair casinos:**

- ✅ Mathematical proof of fairness
- ✅ Verify any result anytime
- ✅ Impossible to manipulate without getting caught

---

## Seeds & Verification

### What are seeds?

Seeds are like the "ingredients" for randomness:

**Server Seed:**

- Our random input
- Kept secret until you verify
- Shown as a "hash" (encrypted fingerprint) before games

**Client Seed:**

- Your random input
- You can change it to anything
- Adds your own unpredictability

**Together:**

- Combined to create game results
- Neither party can predict the outcome alone

### Why do I need to rotate seeds to verify?

**Two-phase security:**

**Phase 1 (Before Games):**

- We show you server seed hash (sealed envelope)
- Server seed stays secret
- If we showed it, you could predict all results

**Phase 2 (After Games):**

- You rotate seeds (open the envelope)
- Server seed is revealed
- Now you can verify it matches the hash and produces your results

This proves we generated the seed BEFORE your games, not after.

### How often should I rotate seeds?

**It's up to you!** Common approaches:

- **Never**: Just trust the system (perfectly valid)
- **Occasionally**: Every few gaming sessions to spot-check
- **Regularly**: Daily or weekly for peace of mind
- **Frequently**: After big wins/losses to verify

**Important:** Your odds are the same regardless of rotation frequency.

### Will rotating seeds change my luck?

**No!** Seed rotation doesn't affect odds:

- All seed combinations are equally random
- House edge is the same
- Winning/losing streaks are normal variance
- Rotating more often doesn't improve or worsen odds

Think of it like shuffling a deck of cards - every shuffle is equally random, one isn't "luckier" than another.

### Can I keep the same client seed forever?

**Yes!** You can:

- Use one client seed for months/years
- Never change it if you don't want to
- Play millions of games on same seed pair
- Still verify later by rotating

The nonce (game counter) makes each game unique even with the same seeds.

---

## Verification

### Do I have to verify every bet?

**No!** Here's why:

- The system works the same whether you verify or not
- Verifying a few bets proves the system works for all bets
- Most players verify occasionally, not every time
- The option is always there when you want it

Think of it like checking your bank statement - you don't verify every transaction, but you check occasionally to ensure everything is correct.

### What happens if verification fails?

**This should NEVER happen!** If it does:

1. Take a screenshot immediately
2. Note the Bet ID
3. Contact support right away
4. We investigate thoroughly
5. Issue is resolved with full transparency

In practice, verification failures don't happen because the system is cryptographically secure.

### Can I verify bets from months ago?

**Yes!** We store everything:

- All your bet history forever
- All revealed server seeds
- All client seeds used
- All nonces

You can verify any bet from any time, even years later.

### How do I know the verification tool isn't lying?

**Multiple ways to verify:**

1. **Our verification tool** (most convenient)
2. **Third-party verifiers** (like Stake.com's tool)
3. **Manual calculation** (using our formulas)
4. **Your own code** (we provide the formulas)

The math is public and standardized - anyone can verify independently.

---

## Security & Trust

### What stops you from showing different hashes to different players?

**Transparency:**

- Server seed hash is recorded in our database
- Tied to your account permanently
- Can't be changed after creation
- Support can check if you report discrepancies

**Cryptography:**

- Changing the hash would require changing the seed
- Changing the seed means a different hash
- Can't create two seeds with same hash (cryptographically impossible)

### Could you generate millions of seeds and pick a bad one for me?

**No, because of your client seed!**

Here's what would happen if we tried:

1. We generate server seed (show you hash)
2. You set/change your client seed
3. Combined result is unpredictable to us

Even if we tested a billion server seeds:

- We don't know what client seed you'll use
- You can change it anytime
- Combined result is unpredictable
- Our pre-testing becomes worthless

### What if you change the server seed after showing the hash?

**Cryptographically impossible!**

If we changed even one character:

```
Original seed: "a1b2c3..."
Original hash: "3f39d5c..."

Changed seed: "a1b2c4..." (changed one character)
New hash: "7k82m9x..." (completely different!)
```

The hash proves the exact seed. Change the seed → hash won't match → verification fails.

### How do I know the house edge is really 1%?

**Multiple proofs:**

1. **Mathematical**: Built into public formulas
2. **Your verification**: Check any bet's payout
3. **Statistical**: Run thousands of games, calculate average
4. **Community**: Other players verify independently
5. **Industry standard**: Same formulas as major casinos

Many players have run simulations with millions of games - the house edge always matches what we claim.

---

## Technical Questions

### What is a hash?

A hash is like a **fingerprint for data:**

**Properties:**

- Same input always creates same fingerprint
- Tiny change in input = completely different fingerprint
- Impossible to reverse (can't recreate input from fingerprint)
- Impossible to fake (can't create different input with same fingerprint)

**Example:**

```
Input: "hello"
Hash: 2cf24dba5fb0a30...

Input: "hello!" (added one character)
Hash: ce06092fb948d9f... (completely different!)
```

### What is HMAC-SHA512?

It's a **cryptographic function** used by:

- Banks for transactions
- Governments for security
- Military for encryption
- Major online casinos

**How it works:**

- Takes your seeds as input
- Applies complex mathematical transformations
- Produces unpredictable, verifiable output
- Battle-tested for decades

You don't need to understand the details - just know it's military-grade security.

### What is a nonce?

A nonce is simply a **counter:**

- Starts at 0 when seeds are created
- Increases by 1 for each game: 0, 1, 2, 3...
- Makes every game unique
- Prevents repeated results

**Why needed:**

```
Without nonce:
Game 1: Server + Client = Result A
Game 2: Server + Client = Result A (same!)
Game 3: Server + Client = Result A (same!)

With nonce:
Game 1: Server + Client + 0 = Result A
Game 2: Server + Client + 1 = Result B (different!)
Game 3: Server + Client + 2 = Result C (different!)
```

### How is randomness generated?

**Three sources of randomness:**

1. **Server Seed**: Cryptographically random (generated using Node.js crypto library)
2. **Client Seed**: Your input (can be anything)
3. **Nonce**: Sequential counter for uniqueness

**Combined:**

- HMAC-SHA512 mixes them together
- Creates unpredictable output
- Same inputs always produce same output (verifiable!)
- Different inputs always produce different output

**For Crash game specifically:**

- Pre-generated seed chain (10 million seeds)
- Bitcoin block hashes (external randomness we can't control)
- Triple-layer security

---

## Game-Specific Questions

### Do all games use the same seeds?

**Yes!** But each game gets different results:

```
Same seeds + nonce 0 + "DICE" = Dice result
Same seeds + nonce 0 + "LIMBO" = Limbo result (different!)
Same seeds + nonce 0 + "CRASH" = Crash result (different!)
```

Game type is included in the formula, so same seeds = different results per game.

### Why do some games feel streaky?

**True randomness includes streaks!**

**Human perception:**

- We expect randomness to be "spread out"
- We notice patterns that confirm our beliefs
- We remember unusual events more than normal ones

**Mathematical reality:**

- Streaks are normal in true randomness
- Flip a coin 100 times: expect multiple 5+ streaks
- "Hot" and "cold" streaks are statistical illusions
- Long-term results match expected house edge

**Proof:**

- Run statistical tests on millions of games
- Results match theoretical distributions
- House edge matches claimed percentage
- No patterns beyond normal variance

### Can I predict future outcomes?

**No!** Even if you know:

- The server seed hash (you see this before playing)
- Your client seed (you set this)
- The nonce (you know the counter)

You still can't predict because:

- Server seed is hidden (only hash shown)
- Can't reverse a hash to get the original seed
- Would take billions of years with all computers on Earth

After seed rotation (reveal), you can verify PAST outcomes, but not predict future ones.

### Why are high multipliers so rare?

**Mathematical probability:**

Each game has different outcome distributions:

**Limbo/Crash:**

- Exponential distribution
- Lower multipliers much more common
- 2x multiplier: ~50% chance
- 10x multiplier: ~10% chance
- 100x multiplier: ~1% chance
- 1000x multiplier: ~0.1% chance

**Plinko:**

- Binomial distribution (bell curve)
- Most balls land near center
- Edge buckets (high multipliers) are rare
- More rows = more extreme edges possible

**Mines:**

- Probability decreases with each revealed tile
- First tile: (Safe tiles / Total tiles)
- Second tile: (Safe tiles - 1) / (Total tiles - 1)
- Gets harder as you reveal more

This is how the real-world probability works, not manipulation!

---

## Comparison Questions

### Is this the same as Stake.com or Shuffle.com?

**Very similar!** We use industry-standard formulas:

**Dice:**

- ✅ Exactly matches Stake.com
- ✅ Exactly matches Shuffle.com

**Limbo:**

- ✅ Exactly matches Stake.com
- Formula: 0.99 ÷ float

**Plinko:**

- ✅ Exactly matches Shuffle.com
- Same binomial distribution algorithm

**Crash:**

- Similar algorithm, different seed system
- We use pre-generated seed chain + Bitcoin blocks
- Stake uses SHA-256 seed chain

**Overall:**

- Same cryptographic standards (HMAC-SHA512, SHA-256)
- Same house edges (1% for most games)
- Same verification process
- Compatible with third-party verifiers

### Can I use Stake.com's verifier for zetik.com bets?

**Yes for some games!** Because we use the same formulas:

- ✅ Dice - Fully compatible
- ✅ Limbo - Fully compatible
- ⚠️ Crash - Different seed system, not compatible
- ⚠️ Plinko - Different multiplier configurations
- ⚠️ Other games - Use our verification tool

### Why did you choose these formulas?

**Industry standards:**

- Battle-tested by millions of players
- Cryptographically secure
- Mathematically proven fair
- Transparent and verifiable
- Compatible with third-party tools

We didn't invent these systems - we adopted the best practices from the industry.

---

## Common Concerns

### I lost 10 times in a row. Is the system rigged?

**No, this is normal variance!**

**Math:**

- Each bet is independent
- Past results don't affect future results
- Losing streaks are expected in random outcomes

**Example:**

- Bet on "Over 50" in Dice (50% win chance)
- Losing 10 in a row: 0.5^10 = 0.0976% chance
- Rare, but happens to someone playing thousands of games

**Proof of fairness:**

- Verify any of those 10 bets
- Each will show correct calculation
- Results match the seeds exactly
- No manipulation possible

**Long-term:**

- Play 10,000 games: results approach expected house edge
- Short-term variance is normal
- Winning and losing streaks both occur

### I won big. Will you not pay me?

**We'll pay!** Here's why:

1. **Escrow system**: Funds held in secure wallets
2. **Automated payouts**: Instant, no manual approval needed
3. **Provably fair**: Your win is verifiable, we can't dispute it
4. **Reputation**: Refusing payouts would destroy our business

Big wins are expected and budgeted for - they're part of the business model. The house edge ensures profitability over millions of bets, not by refusing to pay winners.

### Can employees or insiders cheat?

**No!** Here's why:

**Server seed is committed before your games:**

- We show you the hash
- Can't be changed without detection
- Your client seed adds randomness we can't predict

**Your verification catches cheating:**

- If seed was changed, hash won't match
- If formula was wrong, verification fails
- Any manipulation is immediately detectable

**Technical safeguards:**

- Seeds generated by cryptographic RNG (not humans)
- Formulas executed by code (not manual)
- Database stores immutable records
- Audit logs track all operations

Even if an employee wanted to cheat, the system prevents it.

### What about VPN or location-based results?

**No difference!** Game outcomes are determined only by:

- Server seed
- Client seed
- Nonce
- Game type

**NOT affected by:**

- Your location
- Your IP address
- Your VPN usage
- Your device type
- Your browser
- Your bet size
- Your account balance
- Your win/loss history

The cryptographic formula doesn't have access to this information. Everyone gets the same results for the same seeds.

---

## Getting Started

### How do I enable provably fair?

**It's always enabled!** Every game automatically:

- Uses provably fair system
- Records seeds and nonces
- Allows verification

You don't need to do anything to enable it.

### Where do I see my seeds?

**In your account:**

1. Go to Account Settings
2. Click "Provably Fair" tab
3. See:
   - Current server seed hash
   - Current client seed (editable)
   - Current nonce
   - Previous revealed seeds

### How do I verify my first bet?

**Easy steps:**

1. **Play a few games** (any game, any amount)
2. **Rotate seeds:**
   - Go to Account → Provably Fair
   - Click "Change Client Seed"
   - Enter new seed or click "Generate Random"
   - Old server seed is now revealed
3. **Verify a bet:**
   - Go to Bet History
   - Click on any bet from the old seed pair
   - Click "Verify Bet"
   - Click "Verify Now"
4. **See results:**
   - ✅ Verified Successfully (expected)
   - Or contact support if any issues

### What should I set my client seed to?

**Anything you want!**

**Popular choices:**

- Random string (click "Generate Random")
- Lucky phrase: "my-lucky-seed-2024"
- Random numbers: "7394829374829"
- Your username: "player123"
- Any text at all

**Doesn't matter for fairness:**

- All seeds are equally random when combined
- Use whatever you're comfortable with
- Can be simple or complex

---

## Troubleshooting

### Can't find provably fair settings

**Location:**

- Click your account/profile icon (top right)
- Select "Account Settings" or "Settings"
- Click "Provably Fair" tab
- Should see seeds and verification options

### Verification button not showing

**Reason:** Server seed not revealed yet

**Solution:**

1. Go to Account → Provably Fair
2. Click "Change Client Seed"
3. Submit new seed
4. Old server seed is now revealed
5. Verification button now appears on old bets

### Old bets show "Pending Verification"

**This is normal!** It means:

- These bets used seeds that aren't revealed yet
- Server seed is still hidden (current active seed)
- Rotate seeds to reveal and verify these bets

**Why:**

- Can't reveal seed while still in use (you could predict results)
- Rotate when ready to verify
- Old bets remain verifiable forever after rotation

### Can't change client seed

**Possible reasons:**

- Active game in progress (finish or cash out first)
- Browser issue (try refresh)
- Connection issue (check internet)

**Solution:**

- Complete any active games
- Refresh the page
- Try again
- Contact support if persists

### Verification tool not working

**Troubleshooting steps:**

1. Refresh the page
2. Try different browser
3. Clear browser cache
4. Check internet connection
5. Try different bet
6. Contact support with Bet ID

### Need help understanding verification result

**Contact support:**

- Live chat (click chat icon)
- Email: support@zetik.com
- Include your Bet ID
- Screenshot the verification screen

Our support team can explain the verification details.

---

## Additional Resources

### Want to learn more?

**Documentation:**

- [Overview](./01-provably-fair-overview.md) - Basic concepts
- [How to Verify](./02-how-to-verify-bets.md) - Step-by-step guide
- [Commitment Schemes](./03-commitment-schemes.md) - How seeds work
- [Game Implementations](./04-game-implementations.md) - How each game works

**External Resources:**

- Third-party verifiers (Stake.com, Shuffle.com)
- Cryptography basics (Wikipedia: HMAC, SHA-256)
- Probability theory (for understanding odds)

### Want to verify independently?

**For developers:**

- See our [technical documentation](../PROVABLY_FAIR_SYSTEM.md)
- Use our public verification API
- Review our open formulas
- Build your own verification tools

**For non-developers:**

- Use third-party verifiers
- Ask a developer friend to check
- Join community discussions
- Trust but verify occasionally

---

## Contact & Support

### Still have questions?

**Get help:**

- 💬 **Live Chat**: Click the chat icon (bottom right)
- 📧 **Email**: support@zetik.com
- 🎫 **Support Ticket**: Account → Support → New Ticket
- 📖 **Help Center**: help.zetik.com (when available)

### Report verification issues

**If verification fails (should never happen):**

1. ⚠️ Don't panic - take a screenshot
2. 📝 Note the Bet ID
3. 📧 Contact support immediately
4. 🔍 We investigate thoroughly
5. ✅ Issue resolved with full transparency

### Feedback welcome

We're always improving! Let us know:

- What's confusing in the documentation
- What features would help you verify
- Ideas for better transparency
- Any concerns about fairness

---

## Quick Tips

### Best Practices

✅ **DO:**

- Verify a few random bets occasionally
- Rotate seeds when you want to verify
- Use strong, unique client seeds
- Save screenshots of verification results
- Contact support if something seems wrong

❌ **DON'T:**

- Obsess over verifying every single bet
- Think rotating more often improves odds
- Use the same client seed on multiple sites
- Trust third-party tools blindly (verify their code)
- Assume losing streaks mean rigging

### Remember

- **Provably fair** = Mathematical proof of fairness
- **Verification** = You checking that proof
- **House edge** = Casino's edge (disclosed and fair)
- **Randomness** = Includes streaks and patterns
- **Trust** = Built through transparency, not blind faith

---

## The Bottom Line

### What Provably Fair Guarantees

✅ **Guaranteed:**

- Outcomes generated before you play
- Results match cryptographic calculation
- Server seed can't be changed after commitment
- You can verify any result anytime
- Math is transparent and auditable

❌ **NOT Guaranteed:**

- You will win (house edge ensures casino profit)
- No losing streaks (variance is normal)
- Outcomes you prefer (randomness doesn't care)

### Why It Matters

**Traditional casinos:**
"Trust us, we're fair."

**Provably fair casinos:**
"Don't trust us, verify yourself."

This is the difference. This is why provably fair matters.

---

_Last Updated: October 14, 2025_
_Play with confidence, verify with ease_
