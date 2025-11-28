# ST8 Integration Documentation

## Overview

ST8 is a third-party game provider integration that enables the Zetik platform to offer casino games to users. This integration includes game launching, balance management, transaction processing, and bonus system functionality.

## Architecture

### Core Components

1. **St8Service** - Main service handling game operations and balance management
2. **St8Controller** - REST API endpoints for ST8 provider callbacks
3. **St8ApiClient** - HTTP client for communicating with ST8 API
4. **St8BonusService** - Bonus management and administration
5. **St8BonusSchedulerService** - Automated bonus status updates

### Key Features

- **Multi-currency Support**: Supports both regular and Asian currency configurations
- **Game Session Management**: Tracks user game sessions and betting activity
- **Balance Operations**: Handles debits, credits, buyins, payouts, and cancellations
- **Bonus System**: Complete bonus creation, management, and tracking
- **Idempotency**: All operations are idempotent to prevent duplicate processing
- **House Edge Tracking**: Integrates with provider house edge calculations
- **Bet Recording**: Records all provider bets in the games.user_bets table

## Configuration

## API Endpoints

### Game Operations

#### Launch Game

```typescript
POST / api / games / launch;
```

Launches a game for a user and returns the game URL.

**Parameters:**

- `gameCode`: ST8 game identifier
- `funMode`: Optional boolean for demo mode

**Response:**

```typescript
{
  game_url: string;
  token: string;
}
```

#### Get Games

```typescript
GET / api / games / st8;
```

Retrieves available games from ST8.

**Response:**

```typescript
{
  games: Array<{
    code: string;
    name: string;
    category: string;
    developer: string;
    // ... other game properties
  }>;
  developers: Array<{
    code: string;
    name: string;
  }>;
  categories: Array<{
    name: string;
    type: string;
  }>;
}
```

### ST8 Provider Callbacks

All ST8 provider callbacks are located at `/provider-games/st8/` and require signature verification.

#### Player Profile

```typescript
POST / provider - games / st8 / player_profile;
```

Returns player information for ST8.

#### Balance

```typescript
POST / provider - games / st8 / balance;
```

Returns current player balance.

#### Debit

```typescript
POST / provider - games / st8 / debit;
```

Processes a bet/debit transaction.

#### Credit

```typescript
POST / provider - games / st8 / credit;
```

Processes a win/credit transaction.

#### Buyin

```typescript
POST / provider - games / st8 / buyin;
```

Processes a buyin transaction.

#### Payout

```typescript
POST / provider - games / st8 / payout;
```

Processes a payout transaction.

#### Cancel

```typescript
POST / provider - games / st8 / cancel;
```

Cancels a previous transaction.

## Bonus System

### Bonus Types

```typescript
enum St8BonusTypeEnum {
  FREE_BETS = 'free_bets',
  FREE_MONEY = 'free_money',
  BONUS_GAME = 'bonus_game',
}
```

### Bonus Statuses

```typescript
enum St8BonusStatusEnum {
  PROCESSING = 'processing',
  FINISHED = 'finished',
  ERROR = 'error',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
}
```

### Bonus Management

#### Create Bonus

```typescript
POST / api / admin / st8 - bonus / create;
```

Creates a new bonus campaign.

**Parameters:**

```typescript
{
  bonus_id: string;
  game_codes: string[];
  type: St8BonusTypeEnum;
  value: string;
  currency: string;
  players: string[];
  count?: number;
  site?: string;
  start_time?: string; // ISO 8601 format
  duration?: number; // in seconds
}
```

#### Get Bonuses

```typescript
GET / api / admin / st8 - bonus;
```

Retrieves bonus campaigns with filtering options.

**Query Parameters:**

- `gameCode`: Filter by game code
- `type`: Filter by bonus type
- `currency`: Filter by currency
- `status`: Filter by status
- `createdByAdminId`: Filter by creator
- `limit`: Number of results
- `offset`: Pagination offset

#### Cancel Bonus

```typescript
POST / api / admin / st8 - bonus / cancel;
```

Cancels an active bonus campaign.

**Parameters:**

```typescript
{
  bonus_id: string;
  site?: string;
  players?: string[];
}
```

## Database Schema

### St8BonusEntity

```sql
CREATE TABLE bonus.st8_bonuses (
  bonus_id varchar PRIMARY KEY,
  game_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  type st8_bonus_type_enum NOT NULL,
  status st8_bonus_status_enum NOT NULL DEFAULT 'processing',
  value numeric(20,8) NOT NULL,
  currency varchar(10) NOT NULL,
  players jsonb NOT NULL,
  count int NULL,
  site varchar(50) NULL,
  start_time timestamp NULL,
  duration int NULL,
  created_by_admin_id uuid NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### Indexes

- `IDX_st8_bonuses_game_codes` - GIN index on game_codes JSONB
- `IDX_st8_bonuses_type` - Index on type column
- `IDX_st8_bonuses_status` - Index on status column
- `IDX_st8_bonuses_created_by_admin_id` - Index on created_by_admin_id

## Security

### Signature Verification

All ST8 provider callbacks require signature verification using the `St8SignatureInterceptor`. The signature is calculated using:

1. Base64 decode the private key
2. Create HMAC-SHA256 signature of the request payload
3. Include signature in the `x-st8-sign` header

### Error Handling

All ST8 operations include comprehensive error handling with proper logging and fallback responses. The `St8ExceptionFilter` ensures that all errors return appropriate ST8-compatible error responses.

## Transaction Flow

### Game Launch Flow

1. User requests to launch a game
2. System creates a game session
3. Determines appropriate ST8 environment based on currency
4. Constructs launch payload with player profile
5. Calls ST8 API to get game URL
6. Updates game session status to started
7. Returns game URL to user

### Betting Flow

1. ST8 sends debit request to `/provider-games/st8/debit`
2. System validates player and checks for existing operation (idempotency)
3. Updates user balance with bet amount
4. Records bet in `games.user_bets` table
5. Updates game session with bet amount
6. Returns success response with new balance

### Winning Flow

1. ST8 sends credit request to `/provider-games/st8/credit`
2. System validates player and checks for existing operation (idempotency)
3. Updates user balance with win amount
4. Updates existing bet record with payout information
5. Updates game session with win amount
6. Emits `user-bet.created` event for analytics
7. Returns success response with new balance

## Monitoring and Logging

### Key Metrics

- Game launch success rate
- Transaction processing time
- Balance operation success rate
- Bonus creation and completion rates
- API response times

### Log Levels

- `debug`: Detailed operation information
- `verbose`: Game URL retrieval
- `log`: General operation status
- `error`: Error conditions and failures

## Troubleshooting

### Common Issues

1. **Signature Verification Failures**
   - Verify private key configuration
   - Check payload encoding
   - Ensure proper header format

2. **Currency Routing Issues**
   - Verify currency is in supported list
   - Check Asian environment configuration
   - Validate currency format

3. **Transaction Duplication**
   - Check idempotency implementation
   - Verify operation ID uniqueness
   - Review transaction history

4. **Balance Inconsistencies**
   - Check balance service integration
   - Verify transaction recording
   - Review house edge calculations

### Debug Commands

```bash
# Check ST8 configuration
curl -X GET "http://localhost:3000/api/games/st8" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test game launch
curl -X POST "http://localhost:3000/api/games/launch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"gameCode": "GAME_CODE", "funMode": false}'
```

## Related Documentation

- [Provider Games Configuration](../apps/backend/src/config/provider-games.config.ts)
- [Balance Service Documentation](../apps/backend/src/balance/balance.service.ts)
- [Game Session Service](../apps/backend/src/provider-games/game-session.service.ts)
- [Admin Panel ST8 Integration](../frontend/admin-panel/src/store/st8Bonus/)
