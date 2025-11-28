/**
 * Crash Game Provably Fair Constants
 *
 * These values are immutable and part of our provably fair commitment.
 * DO NOT MODIFY after seeding event - any changes would break player verification.
 *
 * Seeding Event Process:
 * 1. Generate 10M seed chain offline
 * 2. Publish TERMINATING_HASH as public commitment
 * 3. Announce future Bitcoin block number for client seed
 * 4. Wait for Bitcoin block to be mined
 * 5. Update BITCOIN_BLOCK_HASH with actual block hash
 * 6. Deploy and activate new provably fair system
 */
export const CRASH_CONSTANTS = {
  // Total games in the seed chain
  CHAIN_LENGTH: 10_000_000,

  // SHA-256 hash of the final seed (game #10,000,000)
  // This is our public commitment, published before Bitcoin block is known
  // Players can verify any seed in the chain hashes forward to this value
  TERMINATING_HASH: '9b3142a7b60fa712963c335a1ce02729796641156a115c52f675c1e1816a7a18', // Set after chain generation

  // Bitcoin block chosen at seeding event (must be future block at time of announcement)
  // This block's hash serves as the client seed for ALL games
  BITCOIN_BLOCK_NUMBER: 850000, // TODO: Set during seeding event

  // Bitcoin block hash (external entropy source)
  // This provides randomness that the casino cannot control or predict
  BITCOIN_BLOCK_HASH: '00000000000000000002e63058c023a9a1de233554f28c7b21380b6c9003f5dd', // TODO: Set after Bitcoin block is mined

  // House edge percentage (1% = 0.01)
  // Used in crash calculation: (2^32 / (h + 1)) * (1 - HOUSE_EDGE)
  HOUSE_EDGE: 0.01,

  // Seeding event timestamp for record keeping
  SEEDING_EVENT_DATE: '2024-01-01T00:00:00.000Z', // TODO: Set during seeding event

  // Starting game index (counts down from this number)
  STARTING_INDEX: 10_000_000,

  // Algorithm constants
  HASH_ALGORITHM: 'sha256',
  HASH_BITS: 32, // First 32 bits of hash used for calculation

  // Multiplier calculation formula constants
  // Formula: multiplier = 1.0 + (timeInSeconds^EXPONENT) * COEFFICIENT
  // These must match frontend constants for consistent graph display
  CRASH_FORMULA_COEFFICIENT: 0.1, // Lower = more exponential (original was 0.1)
  CRASH_FORMULA_EXPONENT: 1.5, // Higher = more exponential (original was 1.5)
} as const;

// Prevent accidental modifications at runtime
Object.freeze(CRASH_CONSTANTS);

/**
 * Validation helper to ensure all constants are set before using
 */
export function validateCrashConstants(): void {
  const errors: string[] = [];

  if (!CRASH_CONSTANTS.TERMINATING_HASH) {
    errors.push('TERMINATING_HASH not set - run seed generation script');
  }

  if (!CRASH_CONSTANTS.BITCOIN_BLOCK_NUMBER || CRASH_CONSTANTS.BITCOIN_BLOCK_NUMBER <= 0) {
    errors.push('BITCOIN_BLOCK_NUMBER not set - announce seeding event first');
  }

  if (!CRASH_CONSTANTS.BITCOIN_BLOCK_HASH) {
    errors.push('BITCOIN_BLOCK_HASH not set - waiting for Bitcoin block to be mined');
  }

  if (!CRASH_CONSTANTS.SEEDING_EVENT_DATE) {
    errors.push('SEEDING_EVENT_DATE not set');
  }

  if (errors.length > 0) {
    throw new Error(`Crash constants not fully configured:\n${errors.join('\n')}`);
  }
}

/**
 * Get provably fair info for display to users
 */
export function getCrashProvablyFairInfo() {
  return {
    chainLength: CRASH_CONSTANTS.CHAIN_LENGTH.toLocaleString(),
    terminatingHash: CRASH_CONSTANTS.TERMINATING_HASH,
    bitcoinBlock: CRASH_CONSTANTS.BITCOIN_BLOCK_NUMBER,
    bitcoinHash: CRASH_CONSTANTS.BITCOIN_BLOCK_HASH,
    houseEdge: `${CRASH_CONSTANTS.HOUSE_EDGE * 100}%`,
    seedingDate: CRASH_CONSTANTS.SEEDING_EVENT_DATE,
    algorithm: 'Stake.com Compatible (SHA-256 HMAC)',
  };
}
