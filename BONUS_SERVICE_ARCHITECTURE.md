# Bonus Service Architecture

## Clean Microservices Architecture

### Bonus Service (Port 4003)

**Role:** Scheduler Only - runs cron jobs

**Dependencies (minimal):**

- @nestjs/schedule - for @Cron decorators
- @nestjs/bullmq - for adding jobs to queue
- Redis - for BullMQ

**Does NOT depend on:**

- ❌ BonusesModule
- ❌ BalanceModule
- ❌ DatabaseModule
- ❌ Any business modules

**What it does:**

1. Runs cron jobs on schedule
2. Adds jobs to BullMQ queue `bonus-calculation`
3. Provides manual trigger endpoints for testing

### Backend (Port 4000)

**Role:** Business Logic - all processing

**Contains:**

- BonusCalculationProcessor
- BonusesModule
- BalanceModule
- Database connections

**What it does:**

1. Processes jobs from BullMQ queue
2. Executes business logic for bonus calculations
3. Creates bonuses in database
4. Sends notifications

## Flow

```
┌─────────────────────────────────────┐
│   Bonus Service (4003)              │
│   ┌──────────────────────────────┐  │
│   │ BonusSchedulerCronService    │  │
│   │                              │  │
│   │ @Cron('0 2 * * 1')          │  │
│   │ scheduleWeeklyBonuses()      │  │
│   └──────────┬───────────────────┘  │
│              │                       │
│              │ bonusQueue.add(...)   │
└──────────────┼───────────────────────┘
               │
               ▼
        ┌──────────────┐
        │  Redis       │
        │  BullMQ      │
        │  Queue       │
        └──────┬───────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Backend (4000)                    │
│   ┌──────────────────────────────┐  │
│   │ BonusCalculationProcessor    │  │
│   │ @Processor('bonus-calc')     │  │
│   │                              │  │
│   │ async process(job) {         │  │
│   │   - Get users                │  │
│   │   - Calculate bonuses        │  │
│   │   - Save to DB               │  │
│   │   - Send notifications       │  │
│   │ }                            │  │
│   └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

## Advantages

### 1. Separation of Concerns

- Bonus Service: only scheduling
- Backend: only business logic

### 2. Independence

- Can deploy separately
- Minimal dependencies
- Easier to test

### 3. Scalability

- Backend can scale horizontally
- Bonus Service runs as single instance

### 4. Maintainability

- Simple code
- Clear responsibilities
- Easy to debug

## Cron Jobs

| Time     | Job Name               | Description      |
| -------- | ---------------------- | ---------------- |
| 1 AM     | scheduleDailyBonuses   | Yesterday's data |
| 2 AM Mon | scheduleWeeklyBonuses  | Last 7 days      |
| 3 AM 1st | scheduleMonthlyBonuses | Previous month   |
| 4 AM     | expireBonuses          | Expired bonuses  |

## Deployment

### Development

```bash
# Terminal 1: Backend
pnpm start:dev

# Terminal 2: Bonus Service
pnpm start:bonus:dev
```

### Production

```bash
# Backend (multiple instances OK)
pm2 start dist/backend/main.js --name "backend" -i max

# Bonus Service (SINGLE instance only)
pm2 start dist/bonus-service/main.js --name "bonus-scheduler" -i 1
```

## Testing

### Manual Trigger

```bash
curl -X POST http://localhost:4003/bonus-trigger/weekly \
  -H "x-simulator-secret: dev-simulator-secret-2024"
```

### Check Logs

**Bonus Service:**

```
📅 Scheduled weekly bonus job: <job-id>
```

**Backend:**

```
[BonusCalculationProcessor] Processing scheduled weekly bonuses...
[BonusCalculationProcessor] Bonus created: 18065 cents for user <user-id>
[BonusCalculationProcessor] Job completed successfully
```

## Environment Variables

### Bonus Service (.env)

```env
BONUS_SERVICE_PORT=4003
REDIS_HOST=localhost
REDIS_PORT=6379
SIMULATOR_SECRET=dev-simulator-secret-2024
```

### Backend (.env)

```env
PORT=4000
REDIS_HOST=localhost
REDIS_PORT=6379
DB_HOST=localhost
DB_PORT=5432
# ... other variables
```
