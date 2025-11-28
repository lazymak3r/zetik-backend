# Game Configuration Entities

This directory contains the database entities for dynamic game configuration management. These entities replace hardcoded game settings with flexible, database-driven configurations that can be managed through the admin panel.

## Overview

The dynamic game configuration system consists of three main entities:

1. **GameConfigEntity** - Main game configuration and settings
2. **GameBetLimitsEntity** - Bet size limits by game and currency
3. **GameMultipliersEntity** - Game-specific multiplier limits and settings

**Note:** Provably fair algorithms remain hardcoded for security reasons and are not configurable through the database.

## Entities

### GameConfigEntity

The main configuration table for all games.

**Features:**

- Game type enumeration (blackjack, crash, dice, keno, limbo, mines, plinko, roulette, slots)
- Status management (enabled, disabled, maintenance)
- Flexible JSONB settings storage
- Version control and effective date ranges
- A/B testing support
- Default house edge configuration

**Usage:**

```typescript
const crashConfig = await gameConfigRepository.findOne({
  where: { gameType: GameType.CRASH, isDefault: true },
});

const settings = crashConfig.settings as GameConfigSettings;
console.log(settings.bettingTimeMs); // 15000
```

### GameBetLimitsEntity

Manages bet size limits by game type, currency, and user tier.

**Features:**

- Currency-specific limits (crypto/fiat)
- User tier support (standard, VIP, high roller, promotional)
- Per-bet, per-session, and daily limits
- Risk management controls
- Autoplay restrictions

**Usage:**

```typescript
const btcLimits = await betLimitsRepository.findOne({
  where: {
    gameType: GameType.CRASH,
    currency: 'BTC',
    limitType: BetLimitType.STANDARD,
  },
});

const settings = btcLimits.settings as BetLimitSettings;
console.log(settings.minBetAmount); // "0.00000001"
```

### GameMultipliersEntity

Controls multiplier limits and game-specific payout configurations.

**Features:**

- Game-specific multiplier types
- Precision and rounding controls
- Maximum payout limits
- Risk-based adjustments
- Progressive multiplier support

**Usage:**

```typescript
const crashMultipliers = await multipliersRepository.findOne({
  where: {
    gameType: GameType.CRASH,
    multiplierType: MultiplierType.CRASH,
  },
});

const settings = crashMultipliers.settings as MultiplierSettings;
console.log(settings.maxMultiplier); // 100.0
```

## Database Schema

All entities use the `games` schema and include:

- UUID primary keys
- Audit fields (createdAt, updatedAt, createdBy, updatedBy)
- JSONB settings for flexible configuration
- Proper indexing for performance
- Foreign key relationships where applicable

## Migrations

Two migration files are provided:

1. **1692648000000-CreateGameConfigTables.ts** - Creates the table structure
2. **1692648000001-SeedGameConfigData.ts** - Populates default configuration data

## Configuration Examples

### Crash Game Settings

```json
{
  "bettingTimeMs": 15000,
  "minCrashPoint": 1.0,
  "maxCrashPoint": 100.0,
  "maxConcurrentGames": 1000,
  "enableAutoplay": true,
  "maxAutoplays": 100,
  "cooldownMs": 1000
}
```

### BTC Bet Limits

```json
{
  "minBetAmount": "0.00000001",
  "maxBetAmount": "1.0",
  "maxBetPerSession": "10.0",
  "maxBetPerDay": "50.0",
  "allowsAutoplay": true,
  "maxAutoplays": 100
}
```

### Crash Multipliers

```json
{
  "minMultiplier": 1.0,
  "maxMultiplier": 100.0,
  "decimalPlaces": 2,
  "roundingMode": "nearest",
  "maxPayoutAmount": "1000000"
}
```

## Admin Panel Integration

These entities are automatically included in the admin panel data source and can be managed through the admin interface. The admin panel can:

- View and edit game configurations
- Manage bet limits by currency and tier
- Configure multiplier settings
- Track configuration changes and history

## Performance Considerations

### Indexes

- All entities include proper indexes on frequently queried fields
- Composite indexes for common query patterns
- Foreign key indexes for relationship queries

### Caching

- Configuration data should be cached at the application level
- Implement cache invalidation on configuration updates
- Consider Redis for distributed caching

### Query Optimization

- Use specific queries instead of loading entire configurations
- Implement configuration service layer for business logic
- Batch configuration loading where possible

## Security Considerations

### Access Control

- All configuration changes should be logged
- Implement role-based access control
- Audit all administrative actions

### Data Validation

- Validate all JSONB settings on save
- Implement business rule validation
- Prevent invalid configuration states

### Backup and Recovery

- Regular backups of configuration data
- Version control for configuration changes
- Rollback procedures for bad configurations

## Migration from Hardcoded Settings

When migrating from hardcoded settings:

1. Run the migration scripts to create tables and seed data
2. Update game services to read from database (excluding provably fair algorithms which remain hardcoded)
3. Implement configuration caching
4. Add admin panel management interfaces
5. Remove hardcoded constants (except provably fair algorithms)

## Future Enhancements

Planned features for future releases:

- Configuration templates and presets
- Advanced A/B testing framework
- Real-time configuration updates
- Configuration approval workflows
- Automated configuration testing
- Performance impact monitoring
