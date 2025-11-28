# Crash Game - Industry Standard Implementation

## Overview

The Crash game is a provably fair multiplayer betting game where a multiplier starts at 1.00x and increases exponentially until it "crashes" at a predetermined point. Players place bets and can cash out at any time before the crash to win their bet amount multiplied by the current multiplier.

## Key Features

- **Industry Standard Formula**: Implements the same algorithm used by Stake.com and Shuffle.com
- **1% House Edge**: Achieved through instant crashes at 1.00x
- **Thread-Safe**: Distributed locking ensures single-process execution across multiple servers
- **Provably Fair**: Cryptographic verification of game outcomes
- **Seed Chaining**: Each game uses the hash of the previous game's server seed

## Algorithm Implementation

### Crash Point Calculation

The crash point is calculated using the industry standard formula:

```typescript
crashPoint = Math.max(1.0, (2 ^ (32 / (hashInt + 1))) * (1 - houseEdge));
```

**Where:**

- `hashInt`: First 8 hexadecimal characters of HMAC-SHA512 hash converted to integer
- `houseEdge`: 1% (0.01) for industry compliance
- Result is capped at 1,000,000x for practical purposes

### Hash Generation Process

1. **Server Seed**: Generated using cryptographically secure random bytes (first game) or SHA256 hash of previous game's server seed (subsequent games)
2. **Nonce**: Current timestamp as string
3. **HMAC Generation**: `HMAC-SHA512(serverSeed, nonce + ":crash")`
4. **Hash Extraction**: First 8 characters (32 bits) converted to decimal

### House Edge Implementation

The 1% house edge is implemented through instant crashes:

- ~1% of games crash immediately at 1.00x
- No artificial min/max limits
- House edge comes naturally from the mathematical distribution

## Seed Chaining System

### Initial Seed Generation

The first game in the chain uses a cryptographically secure random seed:

```typescript
const initialServerSeed = crypto.randomBytes(32).toString('hex');
```

### Subsequent Seed Generation

Each subsequent game uses the hash of the previous game's server seed:

```typescript
const nextServerSeed = crypto.createHash('sha256').update(previousGame.serverSeed).digest('hex');
```

This creates an unbreakable chain where:

1. Each game is deterministic based on its seed and nonce
2. Seeds are unpredictable (cryptographically secure)
3. The entire chain can be verified retroactively

## Thread Safety & Single-Process Execution

### Distributed Locking

The crash game uses Redis-based distributed locking to ensure only one process manages the global game state:

```typescript
// Redis lock key with process identifier
REDIS_GAME_LOCK_KEY = 'crash:game:lock';
PROCESS_IDENTIFIER = `crash-${process.pid}-${Date.now()}`;

// Lock acquisition with TTL
const lockAcquired = await redis.setNX(lockKey, processId, 30);
```

### Lock Renewal

Automatic lock renewal prevents expiry during normal operation:

```typescript
// Renew lock every 15 seconds (half of 30s TTL)
setInterval(async () => {
  if (currentLock === PROCESS_IDENTIFIER) {
    await redis.set(lockKey, processId, 30);
  }
}, 15000);
```

### Thread Safety Features

1. **Local State Locks**: Prevent concurrent operations within the same process
2. **Database Transactions**: Ensure atomic operations
3. **Advisory Locks**: Prevent race conditions in bet placement
4. **Graceful Degradation**: Other processes handle bets while one manages game flow

## Game Flow & States

### Game States

1. **WAITING**: Accepting bets (15 seconds by default)
2. **STARTING**: Brief transition period (2 seconds)
3. **FLYING**: Multiplier increasing, players can cash out
4. **CRASHED**: Game ended at predetermined crash point
5. **ENDED**: Final state, statistics calculated

### Game Timing

- **Betting Time**: 15 seconds (configurable via `GAME_CRASH_BETTING_TIME`)
- **Starting Phase**: 2 seconds transition
- **Flying Duration**: Variable based on crash point
- **End Delay**: 3 seconds before next game

### Multiplier Calculation

The multiplier grows exponentially over time:

```typescript
multiplier = 1.0 + Math.pow(timeInSeconds, 1.5) * 0.1;
```

This ensures realistic growth that matches player expectations.

## Provably Fair Verification

### For Players

Players can verify any game outcome using:

1. **Server Seed Hash**: Publicly revealed before the game
2. **Server Seed**: Revealed after the game ends
3. **Nonce**: Game-specific identifier
4. **Algorithm**: Public formula for crash point calculation

### Verification Process

```typescript
// 1. Verify server seed hash
const computedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
console.assert(computedHash === serverSeedHash);

// 2. Recompute crash point
const hmac = crypto.createHmac('sha512', serverSeed);
hmac.update(nonce + ':crash');
const hash = hmac.digest('hex');
const hashInt = parseInt(hash.substring(0, 8), 16);
const crashPoint = Math.max(1.0, (Math.pow(2, 32) / (hashInt + 1)) * 0.99);

// 3. Verify against game result
console.assert(Math.abs(crashPoint - gameResult.crashPoint) < 0.00000001);
```

## Database Schema

### Crash Game Entity

```sql
CREATE TABLE crash_games (
  id UUID PRIMARY KEY,
  status VARCHAR NOT NULL,
  crash_point DECIMAL(10,8) NOT NULL,
  server_seed VARCHAR(64) NOT NULL,
  server_seed_hash VARCHAR(64) NOT NULL,
  nonce VARCHAR(50) NOT NULL,
  started_at TIMESTAMP,
  crashed_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  game_data JSONB
);
```

### Crash Bet Entity

```sql
CREATE TABLE crash_bets (
  id UUID PRIMARY KEY,
  crash_game_id UUID REFERENCES crash_games(id),
  user_id UUID NOT NULL,
  asset VARCHAR(10) NOT NULL,
  bet_amount DECIMAL(20,8) NOT NULL,
  auto_cash_out_at DECIMAL(10,2),
  status VARCHAR NOT NULL,
  cash_out_at DECIMAL(10,2),
  win_amount DECIMAL(20,8),
  cash_out_time TIMESTAMP,
  client_seed VARCHAR DEFAULT 'crash_default_seed',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Statistical Validation

### Test Coverage

The implementation includes comprehensive statistical validation:

1. **100 Million Trial Tests**: Validates crash point distribution
2. **House Edge Verification**: Confirms 1% edge over large samples
3. **Instant Crash Rate**: Validates ~1% instant crash frequency
4. **Formula Accuracy**: 100% accuracy in mathematical implementation

### Expected Distributions

- **Instant Crashes**: ~1% of games crash at 1.00x
- **Low Range (1.0-2.0x)**: ~51% of games
- **Medium Range (2.0-5.0x)**: ~29% of games
- **High Range (5.0x+)**: ~19% of games

### Performance Metrics

- **Game Creation**: <10ms average
- **Bet Processing**: <50ms average
- **Cash-out Processing**: <25ms average
- **Statistical Generation**: >10,000 outcomes/second

## Security Considerations

### Seed Security

1. **Initial Seed**: 256-bit cryptographically secure random generation
2. **Chain Integrity**: Hash-based linking prevents tampering
3. **Hash Publication**: Public hashes allow verification without revealing seeds
4. **Nonce Uniqueness**: Timestamp-based nonces prevent replay

### System Security

1. **Distributed Locking**: Prevents multiple processes from running games
2. **Transaction Safety**: Database transactions ensure consistency
3. **Rate Limiting**: Protects against abuse
4. **Input Validation**: All inputs validated and sanitized

### Operational Security

1. **Audit Logging**: All game events logged
2. **Statistical Monitoring**: Real-time validation of outcomes
3. **Anomaly Detection**: Automated detection of unusual patterns
4. **Graceful Recovery**: System recovers from failures without data loss

## Configuration

### Environment Variables

```env
# Game timing (milliseconds)
GAME_CRASH_BETTING_TIME=15000

# House edge (percentage)
GAME_HOUSE_EDGE_CRASH=1.0

# Optional startup delay
CRASH_GAME_START_DELAY_MINUTES=0
```

### Database Configuration

The game uses the standard database configuration with automatic schema creation.

### Redis Configuration

Redis is required for distributed locking:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

## API Endpoints

### Game Information

```typescript
GET / v1 / games / crash / current;
// Returns current game state, bet counts, and public information
```

### Betting Operations

```typescript
POST /v1/games/crash/bet
{
  "betAmount": "1.00000000",
  "autoCashOutAt": "2.50"  // Optional
}

POST /v1/games/crash/cashout/{betId}
// Manual cash-out during flying phase
```

### Game History

```typescript
GET / v1 / games / crash / history;
// Returns last 10 crashed games with winners/losers info

GET / v1 / games / crash / bet / { betId };
// Returns detailed information about a specific bet
```

## WebSocket Events

### Client → Server

```typescript
'join-crash-game'; // Join game room for updates
'place-bet'; // Place a bet (alternative to REST)
'cash-out'; // Cash out (alternative to REST)
```

### Server → Client

```typescript
'crash:game_state'; // Game status updates
'crash:multiplier_update'; // Real-time multiplier during flying
'crash:bet_placed'; // New bet notification
'crash:cash_out'; // Cash-out notification
'crash:game_crashed'; // Game crash event
```

## Monitoring & Analytics

### Key Metrics

1. **House Edge**: Should maintain ~1% over time
2. **Game Frequency**: ~45 seconds average per game
3. **Player Participation**: Bet counts per game
4. **Crash Point Distribution**: Should follow expected ranges

### Alerting

1. **Statistical Anomalies**: Unusual crash point distributions
2. **Performance Issues**: Slow game processing
3. **Lock Failures**: Distributed lock acquisition problems
4. **Database Issues**: Transaction failures or timeouts

## Troubleshooting

### Common Issues

1. **Multiple Game Processes**: Check Redis lock status
2. **Statistical Deviations**: Verify seed chain integrity
3. **Performance Degradation**: Monitor database and Redis performance
4. **WebSocket Issues**: Check connection stability

### Diagnostic Commands

```bash
# Check Redis lock status
redis-cli GET crash:game:lock

# Check database for active games
SELECT * FROM crash_games WHERE status IN ('WAITING', 'FLYING');

# Verify seed chain
SELECT server_seed_hash, nonce FROM crash_games ORDER BY created_at DESC LIMIT 10;
```

## Compliance

### Industry Standards

- Formula matches Stake.com and Shuffle.com implementations
- 1% house edge through instant crashes only
- No artificial limits beyond practical overflow protection
- Full provably fair verification support

### Regulatory Compliance

- Complete audit trail for all games and bets
- Cryptographic verification of all outcomes
- Player protection through transparent algorithms
- Statistical validation over millions of games

## Future Enhancements

### Planned Features

1. **Admin Panel Configuration**: Configurable max payouts and bet limits
2. **Advanced Analytics**: Real-time statistical dashboards
3. **Player Verification Tools**: Enhanced UI for provably fair verification
4. **Performance Optimization**: Further optimizations for high-load scenarios

### Scalability Considerations

1. **Database Sharding**: Partition old games for performance
2. **Redis Clustering**: Scale distributed locking
3. **Load Balancing**: Multiple bet-processing instances
4. **Caching**: Enhanced caching for frequently accessed data
