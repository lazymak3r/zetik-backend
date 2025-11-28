# Backend Documentation

This directory contains comprehensive documentation for the zetik.com casino backend system.

## Available Documentation

### [Provably Fair System](./PROVABLY_FAIR_SYSTEM.md)

**Status**: ✅ Production Ready | **Version**: 2.0 | **Compliance**: Stake.com Compatible | **Audience**: Developers & Engineers

Comprehensive technical documentation of our provably fair gaming system, including:

- **Core Components**: ProvablyFairService, BytesToFloatService, Seed Management
- **Cryptographic Foundation**: HMAC-SHA512, Bytes-to-Float Normalization
- **Game Implementations**: Detailed formulas and examples for all games
  - Dice (0.00-100.00, Stake.com compatible)
  - Limbo (Exponential distribution, 1% house edge)
  - Crash (Pre-generated seed chain with Bitcoin block entropy)
  - Plinko (Binomial distribution, 27 configurations)
  - Mines (Fisher-Yates shuffle)
  - And more...
- **Seed Management**: Generation, rotation, verification
- **Statistical Validation**: Comprehensive testing suite and results
- **Industry Standards**: Comparison with Stake.com and Shuffle.com
- **Security Considerations**: Attack prevention and best practices
- **API Reference**: Complete endpoint documentation
- **Mathematical Proofs**: House edge calculations and distribution analysis

**Use this documentation to**:

- Understand the provably fair system architecture
- Verify game implementations against industry standards
- Learn how to verify game outcomes
- Run statistical validation tests
- Integrate provably fair verification in frontend
- Audit security and fairness

---

### [Provably Fair - Player Guide](./PROVABLY_FAIR_PLAYER_GUIDE.md)

**Status**: ✅ Production Ready | **Version**: 1.0 | **Audience**: Players & Support

Player-friendly guide to understanding and verifying provably fair games, including:

- **What is Provably Fair?**: Simple explanation for non-technical users
- **How to Verify Your Games**: Step-by-step instructions
- **Game-by-Game Verification**: Separate sections for each game
  - Dice - Roll verification with copy-paste scripts
  - Limbo - Multiplier verification
  - Crash - Seed chain verification
  - Plinko - Ball path verification
  - Mines - Mine position verification
  - Roulette - Number verification
- **Copy-Paste Verification Scripts**: Ready-to-use browser console scripts
- **FAQ**: Common questions answered
- **Best Practices**: How to verify responsibly

**Use this documentation to**:

- Explain provably fair to players
- Help players verify their game results
- Train support staff on verification
- Create help center articles
- Build trust through transparency

---

## Quick Links

### Implementation Files

- **ProvablyFairService**: `apps/backend/src/games/services/provably-fair.service.ts`
- **BytesToFloatService**: `apps/backend/src/games/services/bytes-to-float.service.ts`
- **SeedPairEntity**: `libs/shared-entities/src/games/seed-pair.entity.ts`

### Test Files

- **Unit Tests**: `apps/backend/src/games/services/__tests__/`
- **Statistical Validation**: `apps/backend/src/games/*/tests/*-statistical-validation.spec.ts`
- **E2E Tests**: `apps/backend/test/provably-fair-*.e2e-spec.ts`

### Scripts

- **Crash Seed Generation**: `apps/backend/scripts/generate-crash-seeds.ts`
- **Statistical Simulation Suite**: `apps/backend/scripts/statistical-simulation-suite.ts`

### Related Documentation (workspace/output-docs/)

- `PROVABLY_FAIR_NORMALIZATION_FIX.md` - Technical details of normalization fix
- `SHUFFLE_VS_CURRENT_IMPLEMENTATION.md` - Industry comparison
- `STAKE_VS_SHUFFLE_LIMBO_COMPARISON.md` - Limbo formula analysis
- `STATISTICAL_VALIDATION_UTILITIES_GUIDE.md` - Testing guide
- `CRASH_PROVABLY_FAIR_IMPLEMENTATION.md` - Crash game details

---

## Quick Start

### Verify a Game Outcome

```typescript
// 1. Get game information
const bet = await getBet(betId);

// 2. Calculate outcome
const hmac = crypto.createHmac('sha512', bet.serverSeed);
hmac.update(`${bet.clientSeed}:${bet.nonce}:${bet.gameType}`);
const hash = hmac.digest('hex');

// 3. Normalize to float
const bytes = Buffer.from(hash, 'hex');
const float = bytesToFloatService.singleBytesToFloat(bytes, 0);

// 4. Game-specific calculation
let outcome;
if (gameType === 'DICE') {
  outcome = Math.floor(float * 10001) / 100;
} else if (gameType === 'LIMBO') {
  outcome = 0.99 / Math.max(0.000001, Math.min(0.999999, float));
}

// 5. Verify
console.log('Expected:', bet.outcome);
console.log('Calculated:', outcome);
console.log('Match:', Math.abs(bet.outcome - outcome) < 0.000001);
```

### Run Statistical Validation

```bash
# Quick test (10K simulations, ~10 seconds)
pnpm simulation:quick

# Standard validation (1M simulations, ~3 minutes)
pnpm simulation:run

# Full validation (10M simulations, ~30 minutes)
pnpm simulation:full
```

### Generate Crash Seeds

```bash
pnpm generate:crash-seeds
```

---

## Standards Compliance

### ✅ Stake.com Compatible

- Bytes-to-Float normalization
- Dice formula (0.00-100.00, includes 100.00)
- Limbo formula (0.99 / float)
- HMAC-SHA512 hash generation

### ✅ Shuffle.com Compatible

- Bytes-to-Float normalization
- Dice formula
- Plinko algorithm

### ⚠️ Industry Standard with Modifications

- Crash game (similar algorithm, different seed system)

---

## Key Features

### Cryptographic Security

- ✅ HMAC-SHA512 (512-bit security)
- ✅ Cryptographically secure random generation
- ✅ SHA-256 server seed hashing
- ✅ Pre-committed next seeds

### Player Verification

- ✅ All outcomes independently verifiable
- ✅ Server seed hash shown before games
- ✅ Seed rotation with revelation
- ✅ Public verification API endpoints

### Statistical Validation

- ✅ Chi-squared distribution tests
- ✅ House edge verification
- ✅ Win rate validation
- ✅ 10M+ simulation capability

### Industry Alignment

- ✅ Matches largest crypto casino (Stake.com)
- ✅ Compatible with third-party verifiers
- ✅ Follows provably fair best practices

---

## Contributing

When adding new documentation:

1. Create markdown files in this directory
2. Update this README with links
3. Follow existing documentation style
4. Include code examples and verification steps
5. Add mathematical proofs where applicable

---

## Support

For questions or issues:

1. **Read the documentation** - Most questions answered in PROVABLY_FAIR_SYSTEM.md
2. **Check the code** - Implementation files are well-documented
3. **Run tests** - Statistical validation provides confidence
4. **Review examples** - Test files contain working examples

---

**Maintainer**: Zetik Backend Team
**Last Updated**: 2025-10-13
**Status**: Production Ready ✅
