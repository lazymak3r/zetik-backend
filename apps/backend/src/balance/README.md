# Balance Module

The Balance module provides centralized balance management with strict business logic rules, full auditability, and primary wallet selection functionality.

## Features

### Balance Operations

- **Unified Balance Updates**: Single `updateBalance` method for all balance modifications
- **Negative Balance Prevention**: Operations that would result in negative balance are rejected
- **Idempotent Operations**: Safe retry mechanism with operation IDs
- **Full Auditability**: All changes recorded in balance history
- **Statistics Tracking**: Automated calculation of deposits, withdrawals, bets, wins, refunds
- **USD Conversion**: Real-time crypto-to-USD conversion for statistics

### Primary Wallet Management

- **Primary Wallet Selection**: Users can designate one wallet as primary per asset type
- **Dynamic Wallet Creation**: Missing wallets are created automatically when selected as primary
- **Asset Validation**: Only supported assets (from `ACTIVE_ASSETS` config) can be selected
- **Atomic Updates**: Primary wallet changes are performed in database transactions

## Key Business Rules

1. **Single Update Method**: All balance modifications must use the unified `updateBalance` method
2. **No Negative Balances**: Operations resulting in negative balances are rejected
3. **First Wallet Primary**: User's first created wallet is automatically set as primary
4. **Supported Assets Only**: Primary wallet selection limited to configured `ACTIVE_ASSETS`
5. **Idempotency**: Duplicate operations (same `operationId`) return previous result
6. **Audit Trail**: Every operation creates immutable history record
7. **USD Statistics**: All statistics maintained in USD with 4 decimal precision

**Balance Module Overview**

The Balance module provides a single `updateBalance` method to adjust a user's balance. All balance changes are recorded in a dedicated history table. The module also maintains statistics on deposits, withdrawals, bets, wins, and refunds. These metrics are used to calculate precise amounts for withdrawal confirmations (payments) and for total wagering calculations (bonuses).

## API Endpoints

### Balance Operations

#### Update Balance

**POST** `/v1/balance/update` (Internal API)

```typescript
interface UpdateBalanceRequest {
  operation: BalanceOperationEnum;
  operationId: string;
  userId: string;
  amount: string;
  asset: AssetTypeEnum;
  description?: string;
  metadata?: Record<string, any>;
}

interface UpdateBalanceResponse {
  success: boolean;
  balance: string;
  error?: string;
}
```

#### Primary Wallet Management

**PATCH** `/v1/balance/primary`

```typescript
interface SwitchPrimaryWalletRequest {
  asset: AssetTypeEnum; // Asset to set as primary
}

interface BalanceWalletResponse {
  userId: string;
  asset: AssetTypeEnum;
  balance: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Returns array of all user wallets with updated primary flags
type SwitchPrimaryWalletResponse = BalanceWalletResponse[];
```

#### Balance History

**GET** `/v1/balance/history`

Query parameters: `asset`, `operation`, `limit`, `offset`

#### Balance Statistics

**GET** `/v1/balance/statistics`

Query parameters: `asset`

#### Daily Statistics

**GET** `/v1/balance/statistics/daily`

Query parameters: `asset`, `startDate`, `endDate`

### API Schema

```typescript
interface UpdateBalanceRequest {
  userId: number; // User identifier
  amount: string; // Balance adjustment amount in USD
}
```

### Workflow

```text
Caller → updateBalance(userId, amount)
  ↓
Balance table updated
  ↓
Record added to balance_history
  ↓
Statistics updated (deposits, withdrawals, bets, wins, refunds)
  ↓
Event emitted for downstream consumers
```

```ts
export enum BalanceOperationEnum {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  ROLLBACK_WITHDRAW = 'ROLLBACK_WITHDRAW',
  BET = 'BET',
  WIN = 'WIN',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
}

export class UpdateBalanceDto {
  @IsEnum(BalanceOperationEnum)
  operation: BalanceOperationEnum;

  @IsUUID()
  operationId: string;

  @IsNumber()
  userId: number;

  @IsNumber()
  @Min(0)
  amount: string; // bignumber.js

  @IsString()
  asset: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

@Entity('balance_change_history')
export class BalanceHistoryEntity {
  @PrimaryColumn('uuid')
  operationId: string;

  @PrimaryColumn({ type: 'varchar' })
  operation: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  amount: string; // bignumber.js

  @Column({ type: 'varchar', length: 3 })
  asset: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  rate: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  amountUSD: string; // bignumber.js // negative for bet and withdarawl

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('balance_change_statistic')
export class BalanceStatisticEntity {
  @PrimaryColumn()
  userId: number;

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  deps: string; // bignumber.js // dep summ in usd

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  withs: string; // bignumber.js // withdrawls summ in usd

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  bets: string; // bignumber.js // bets summ in usd

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  wins: string; // bignumber.js // wins summ in usd

  @Column({ type: 'decimal', precision: 20, scale: 8, default: 0 })
  refunds: string; // bignumber.js  // refunds summ in usd
}
```
