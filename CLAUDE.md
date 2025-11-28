# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in the zetik-backend repository.

## Repository Overview

This is a **NestJS monorepo** for the zetik.com casino platform backend, implementing a multi-process microservices architecture with:

- **Main Casino API**: Multi-process backend with Node.js cluster mode (auto-scales to CPU count)
- **Single-Instance Microservices**: Crash, Fireblocks, Bonus, Bet Feed, Race services (must not duplicate)
- **Cron-Only Services**: Currency Rate service
- **Admin Panel**: Separate backend API and React UI for administration

**Node Version Requirement**: Node.js v24 or higher

## Architecture

### Multi-Process Microservices Design

The backend separates **scalable multi-process services** from **single-instance services** that manage global state:

#### Multi-Process Services (Scales to CPU count)

- **Main Backend API** (`apps/backend`, port 4000)
  - NestJS REST API with Node.js cluster mode in production
  - Worker processes auto-scaled to available CPU cores
  - Redis-backed WebSocket adapter for cross-process communication
  - Session persistence across workers via Redis
  - Zero-downtime deployments via SIGUSR2 signal

#### Single-Instance Microservices (Must not duplicate)

- **Crash Service** (`apps/crash-service`, port 4001)
  - Manages multiplayer crash game rounds and global state
  - Single instance required to prevent state conflicts

- **Fireblocks Service** (`apps/fireblocks-service`, port 4002)
  - Handles Fireblocks payment webhooks with idempotency
  - Single instance to prevent duplicate transaction processing

- **Bonus Service** (`apps/bonus-service`, port 4003)
  - BullMQ processor for bonus calculations
  - Scheduled jobs for daily/weekly/monthly bonuses
  - Single instance to prevent duplicate bonus payouts

- **Bet Feed Service** (`apps/bet-feed-service`, port 4004)
  - Manages global bet feed state and WebSocket broadcasting
  - Broadcasts recent bets to all connected clients every 10 seconds
  - Single instance to prevent duplicate queries and broadcasts
  - Positioned for future delta-based updates (send only changes)

- **Race Service** (`apps/race-service`, port 4005)
  - Handles race wager distribution to leaderboards
  - Drains accumulated wagers from Redis and distributes to race-specific leaderboards
  - Runs every 10 seconds to update all active race leaderboards
  - Single instance to prevent duplicate distribution operations
  - Broadcasts WebSocket events for leaderboard updates

#### Cron-Only Services (No HTTP server)

- **Currency Rate Service** (`apps/currency-rate-service`)
  - Cron job for currency rate updates (twice daily)

#### Admin Panel

- **Admin Backend API** (`apps/admin-panel`, port 3001)
  - Separate NestJS API for admin operations

- **Admin Frontend UI** (`frontend/admin-panel`, port 3002)
  - React admin dashboard

### Infrastructure Stack

- **Database**: PostgreSQL 17 with TypeORM
- **Cache/Session**: Redis 7.4 for sessions, WebSocket broadcasting, and caching
- **Queue**: BullMQ for background job processing
- **Real-time**: Socket.io with Redis adapter for WebSocket connections
- **Payments**: Fireblocks integration for crypto transactions
- **Storage**: MinIO (S3-compatible) for file uploads

## Project Structure

```
zetik-backend/
├── apps/
│   ├── backend/                     # Main casino backend (port 4000)
│   │   ├── src/
│   │   │   ├── auth/                # Authentication & JWT
│   │   │   ├── users/               # User management
│   │   │   ├── payments/            # Payment operations
│   │   │   ├── balance/             # Balance tracking
│   │   │   ├── bonus/               # VIP tiers & bonuses
│   │   │   ├── games/               # Game modules
│   │   │   │   ├── blackjack/
│   │   │   │   ├── crash/
│   │   │   │   ├── dice/
│   │   │   │   ├── keno/
│   │   │   │   ├── limbo/
│   │   │   │   ├── mines/
│   │   │   │   ├── plinko/
│   │   │   │   └── roulette/
│   │   │   ├── provider-games/     # Third-party slots
│   │   │   ├── affiliate/           # Affiliate system
│   │   │   ├── blog/                # Content management
│   │   │   ├── chat/                # Chat system
│   │   │   ├── websocket/           # WebSocket gateway
│   │   │   ├── migrations/          # TypeORM migrations
│   │   │   ├── cluster.ts           # Cluster mode entry point
│   │   │   ├── main.ts              # Single-process entry
│   │   │   └── data-source.ts       # TypeORM config
│   │   ├── scripts/                 # Utility scripts
│   │   ├── test/                    # E2E tests
│   │   └── Dockerfile
│   ├── admin-panel/                 # Admin backend (port 3001)
│   ├── crash-service/               # Crash game service (port 4001)
│   ├── fireblocks-service/          # Payment webhooks (port 4002)
│   ├── bonus-service/               # Bonus processing (port 4003)
│   ├── bet-feed-service/            # Bet feed broadcasting (port 4004)
│   ├── race-service/                # Race wager distribution (port 4005)
│   └── currency-rate-service/       # Currency rate cron
├── frontend/
│   └── admin-panel/                 # Admin UI (port 3002)
├── libs/
│   ├── common/                      # Shared utilities, enums, validators
│   └── shared-entities/             # Shared TypeORM entities
├── dev/
│   └── docker-compose.yml           # Development Docker setup
├── scripts/                         # Monorepo-level scripts
├── docker-compose.yml               # Production Docker setup
├── nest-cli.json                    # NestJS monorepo config
├── package.json                     # Monorepo root package
├── pnpm-workspace.yaml              # pnpm workspace config
└── turbo.json                       # Turbo build config
```

## Development Commands

### Local Development (Without Docker)

```bash
# Install dependencies
pnpm install

# Start main services
pnpm start:dev                       # Main backend (port 4000, no cluster)
pnpm start:admin:dev                 # Admin backend (port 3001)
pnpm start:all:dev                   # Both main + admin together

# Start microservices
pnpm start:crash:dev                 # Crash service (port 4001)
pnpm start:fireblocks:dev            # Fireblocks service (port 4002)
pnpm start:bonus:dev                 # Bonus service (port 4003)
pnpm start:bet-feed:dev              # Bet feed service (port 4004)
pnpm start:race:dev                  # Race service (port 4005)
pnpm start:currency-rate:dev         # Currency rate service (cron only)
pnpm start:all:services              # All microservices together

# Development with debugging
pnpm start:debug                     # Main backend with debugger
```

### Docker Development

```bash
# Development environment (different ports to avoid conflicts)
cd dev
docker-compose up -d                 # Start dev containers

# Production-like environment (with cluster mode)
docker-compose up -d                 # Start all services
docker-compose up backend            # Start only main backend
docker-compose logs -f backend       # View backend logs
docker-compose down                  # Stop all services
docker-compose down -v               # Stop and remove volumes
```

### Database Management

```bash
# Run migrations (auto-runs on app start)
pnpm db:migration:backend:run

# Revert last migration
pnpm db:migration:backend:revert

# Generate new migration
cd apps/backend
pnpm migration:generate src/migrations/MigrationName

# Create empty migration
pnpm migration:create src/migrations/MigrationName

# Generate crash game seed chain
pnpm generate:crash-seeds

# Seed database
pnpm seed
```

### Building

```bash
# Build all packages
pnpm build

# Build specific services
pnpm build:backend                   # Main backend
pnpm build:admin                     # Admin panel
pnpm build:crash                     # Crash service
pnpm build:fireblocks                # Fireblocks service
pnpm build:bonus                     # Bonus service
pnpm build:bet-feed                  # Bet feed service
pnpm build:race                      # Race service
pnpm build:currency-rate             # Currency rate service
pnpm build:services                  # All microservices

# Watch mode for shared libraries
pnpm watch                           # Watch common + shared-entities
```

### Testing

```bash
# Unit tests (all packages)
pnpm test                            # Run all unit tests
pnpm test:watch                      # Watch mode
pnpm test:cov                        # With coverage

# E2E tests
pnpm test:e2e                        # Run E2E tests
pnpm pretest:e2e                     # Setup test database

# Generate test report
pnpm test:report                     # Create TEST_COVERAGE.md
pnpm test:all                        # Run all tests + report

# Test specific package
pnpm -F @zetik/backend test          # Backend unit tests
pnpm -F @zetik/backend test:e2e      # Backend E2E tests
```

### Code Quality

```bash
# Linting
pnpm lint                            # ESLint with auto-fix

# Formatting
pnpm format                          # Prettier on all TS files

# Pre-commit checks
pnpm precommit                       # Lint-staged (husky)
```

## Database Schema

PostgreSQL schemas are automatically created on startup:

- **users**: User accounts, authentication, profiles
- **payments**: Transactions, wallets, deposits, withdrawals
- **balance**: Balance tracking and history
- **admin**: Admin panel data and settings
- **bonus**: VIP tiers, bonuses, rewards
- **games**: All game-related tables (bets, results, seeds)

## API Endpoints

### Main Backend (port 4000)

- `/v1/auth/*` - Authentication (login, register, refresh)
- `/v1/users/*` - User management (profile, settings)
- `/v1/payments/*` - Payment operations (deposit, withdraw)
- `/v1/games/*` - Game endpoints (bet, result, history)
- `/v1/balance/*` - Balance management (check, history)
- `/v1/bonus/*` - Bonus operations (claim, check)
- `/v1/affiliate/*` - Affiliate management
- `/v1/chat/*` - Chat operations

### Admin Panel (port 3001)

- `/api/auth/*` - Admin authentication
- `/api/dashboard/*` - Dashboard statistics
- `/api/users/*` - User management
- `/api/transactions/*` - Transaction management
- `/api/settings/*` - System settings
- `/api/games/*` - Game configuration

## Environment Setup

### Main Backend (.env)

Create `apps/backend/.env`:

```bash
# Node Environment
NODE_ENV=development
PORT=4000

# Cluster Mode (Production only)
NODE_CLUSTER_ENABLED=false           # Set to true in production
NODE_CLUSTER_WORKERS=auto            # Auto-scales to CPU count

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production

# Fireblocks (Optional - for payments)
FIREBLOCKS_API_KEY=your-api-key
FIREBLOCKS_VAULT_ACCOUNT_ID=0

# MinIO (S3-compatible storage)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
```

### Admin Panel (.env)

Create `apps/admin-panel/.env`:

```bash
NODE_ENV=development
ADMIN_PORT=3001
ADMIN_JWT_SECRET=admin-secret-change-in-production

# Database (same as main backend)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
```

## Port Allocation

### Frontend

- **3000**: Frontend dev server (zetik-frontend)
- **3002**: Admin panel UI

### Backend Services

- **3001**: Admin backend API
- **4000**: Main backend API (multi-process with cluster in production)
- **4001**: Crash service (single-instance)
- **4002**: Fireblocks service (single-instance)
- **4003**: Bonus service (single-instance)
- **4004**: Bet feed service (single-instance)
- **4005**: Race service (single-instance)

### Infrastructure

- **5432**: PostgreSQL
- **6379**: Redis
- **9000**: MinIO API
- **9001**: MinIO Console

### Development Ports (dev/docker-compose.yml)

- **3100**: Main backend API
- **4101**: Crash service
- **4102**: Fireblocks service
- **4103**: Bonus service
- **5432**: PostgreSQL
- **26379**: Redis

## Service Communication

All services communicate via:

1. **Shared PostgreSQL Database**: Single source of truth for all data
2. **Redis Pub/Sub**: Real-time event broadcasting
3. **Socket.io Redis Adapter**: WebSocket message distribution across backend workers
4. **BullMQ Queues**: Background job processing (bonus calculations)

**No direct HTTP calls between services** - all communication is database-driven or event-driven.

## Game Implementation

### Available Games

Each game module in `apps/backend/src/games/` includes:

- **Provably fair verification**: Cryptographic proof of fairness
- **Real-time updates**: WebSocket integration
- **Complete game logic**: Bet validation, RNG, payout calculation
- **Comprehensive tests**: Unit and E2E test coverage

Games implemented:

- **Blackjack**: Classic card game with optimal strategy
- **Crash**: Multiplayer game with shared state (runs in crash-service)
- **Dice**: Roll prediction game
- **Keno**: Number selection lottery
- **Limbo**: High-risk multiplier game
- **Mines**: Grid-based mine avoidance
- **Plinko**: Ball drop probability game
- **Roulette**: Classic casino wheel

### Third-Party Games

- **Slots**: Provider-integrated slot machines (`provider-games/`)

## Common Development Tasks

### Adding a New Game

1. Create game module in `apps/backend/src/games/your-game/`
2. Implement game service with provably fair logic
3. Create DTOs for bet placement and results
4. Add game entity to `libs/shared-entities/src/games/`
5. Create migration for game-specific tables
6. Write comprehensive tests (unit + E2E)
7. Add WebSocket gateway if real-time updates needed
8. Update game configuration in admin panel

### Adding a New Microservice

1. Create new app in `apps/your-service/`
2. Add to `nest-cli.json` projects
3. Add build script to root `package.json`
4. Create Dockerfile in service directory
5. Add service to `docker-compose.yml`
6. Document service architecture and port allocation

### Database Operations

```bash
# Connect to database
docker exec -it zetik_postgres psql -U postgres -d postgres

# Reset database (development only!)
docker-compose down -v
docker-compose up -d
pnpm db:migration:backend:run
pnpm seed

# Run specific migration
docker exec -i zetik_postgres psql -U postgres -d postgres < migration.sql

# Check database connection
pnpm test:db
```

### Debugging

```bash
# View logs
docker-compose logs -f backend       # Backend logs
docker-compose logs -f crash-service # Crash service logs
docker-compose logs -f postgres      # Database logs
docker-compose logs -f redis         # Redis logs

# Check container status
docker-compose ps

# Check Redis data
docker exec -it zetik_redis redis-cli
> KEYS *
> GET key_name

# Check BullMQ jobs
docker exec -it zetik_redis redis-cli
> KEYS bull:*
```

## Cluster Mode & Zero-Downtime Deployments

### Cluster Mode (Production)

The main backend runs in **cluster mode** in production:

```bash
# Enable cluster mode
NODE_CLUSTER_ENABLED=true NODE_CLUSTER_WORKERS=auto pnpm start:backend:cluster

# Or via Docker (automatically enabled)
docker-compose up backend
```

**How it works:**

- Master process spawns worker processes (one per CPU core)
- Each worker handles HTTP requests independently
- Redis adapter synchronizes WebSocket messages across workers
- Sessions stored in Redis, accessible by all workers

### Zero-Downtime Deployment

```bash
# Send SIGUSR2 signal for rolling restart
docker exec zetik_backend kill -SIGUSR2 1

# Or use Docker green/blue deployment
docker-compose up -d backend-blue
# Switch traffic
docker-compose up -d backend-green
```

### Single-Instance Services

**CRITICAL**: Never run multiple instances of:

- Crash service (port 4001)
- Fireblocks service (port 4002)
- Bonus service (port 4003)
- Bet feed service (port 4004)
- Race service (port 4005)

These services manage global state and must remain single-instance.

## Cluster Mode Operations

### Configuration

Environment variables for cluster mode:

```bash
# .env configuration
NODE_CLUSTER_ENABLED=true        # Enable cluster mode
NODE_CLUSTER_WORKERS=auto        # Auto-scale to CPU count (or specify: 2, 4, 8, etc.)
```

### Starting Cluster Mode

```bash
# Local development with cluster
NODE_CLUSTER_ENABLED=true pnpm start:backend:cluster

# Docker (cluster mode enabled by default)
docker-compose up -d backend

# Custom worker count
NODE_CLUSTER_ENABLED=true NODE_CLUSTER_WORKERS=4 node dist/cluster.js
```

### Health Monitoring

```bash
# Check comprehensive health (includes cluster info)
curl http://localhost:4000/health

# Liveness probe (simple alive check)
curl http://localhost:4000/health/live

# Readiness probe (ready to accept traffic)
curl http://localhost:4000/health/ready
```

**Health Response Example**:

```json
{
  "status": "ok",
  "timestamp": "2025-10-09T12:00:00.000Z",
  "uptime": 3600.5,
  "memory": {...},
  "pid": 12345,
  "cluster": {
    "enabled": true,
    "workerId": 2,
    "workerPid": 12345,
    "isWorker": true
  }
}
```

### Rolling Restart (Zero-Downtime)

Restart workers one at a time without dropping requests:

```bash
# Send SIGUSR2 signal to master process
kill -USR2 <master-pid>

# Or via Docker
docker exec zetik-backend kill -SIGUSR2 1
```

**Rolling Restart Flow**:

1. Master receives SIGUSR2
2. For each worker (sequentially):
   - Forks new worker
   - Waits for new worker to be ready
   - Gracefully disconnects old worker
   - Moves to next worker
3. Zero dropped requests

### Worker Restart Management

**Automatic Crash Recovery**:

- Workers automatically restart on crash
- Maximum 5 restarts per slot within 60 seconds
- Restart counter resets after 60-second window

**Restart Limit Reached**:

```
⚠️ Worker slot 0 exceeded max restarts (5) within 60s window, not restarting
```

**Resolution**:

- Check logs for root cause: `docker logs zetik-backend`
- Fix underlying issue (database connection, memory leak, etc.)
- Restart entire cluster: `docker restart zetik-backend`

### Graceful Shutdown

**Shutdown Flow**:

```bash
# Send SIGTERM to master
kill -TERM <master-pid>

# Or via Docker (automatically sends SIGTERM)
docker stop zetik-backend
```

**What Happens**:

1. Master sends shutdown message to all workers
2. Workers call `app.close()` for graceful shutdown
3. Workers finish in-flight requests (30s grace period)
4. Workers close all connections (DB, Redis, WebSocket)
5. Workers exit cleanly
6. If workers don't exit in 30s, master force kills them

### Monitoring Workers

**Check Active Workers**:

```bash
# List all cluster processes
ps aux | grep "node dist/cluster.js"

# Check Docker container logs
docker logs -f zetik-backend
```

**Monitor Worker Distribution**:

```bash
# Make multiple requests to see load distribution
for i in {1..20}; do
  curl -s http://localhost:4000/health | jq '.cluster.workerId, .pid'
done
```

### Troubleshooting

**Issue: Worker Crash Loop**

```bash
# Check crash logs
docker logs zetik-backend | grep "died with code"

# Check restart attempts
docker logs zetik-backend | grep "Restarting worker slot"
```

**Solution**: Fix root cause (check DB connection, Redis connection, memory limits)

**Issue: Rolling Restart Hangs**

```bash
# Check for stuck workers
ps aux | grep "node dist/cluster.js"

# Force restart if needed
docker restart zetik-backend
```

**Issue: Uneven Load Distribution**

- Normal OS behavior (round-robin not perfect)
- Check for long-running requests blocking workers
- Monitor memory usage per worker

### Documentation

For comprehensive cluster operations guide, see:

- `output-docs/cluster-mode-operations-guide.md` - Complete operations guide
- `apps/backend/src/cluster.ts` - Cluster implementation
- `apps/backend/src/main.ts` - Worker bootstrap with graceful shutdown
- `apps/backend/src/common/controllers/health.controller.ts` - Health checks

## Testing & Quality Assurance

### Test Structure

- **Unit tests**: Co-located with source files (`*.spec.ts`)
- **E2E tests**: In `apps/backend/test/` (`*.e2e-spec.ts`)
- **Integration tests**: Use real database, no mocks
- **Test database**: Automatically created/cleaned for each test run

### Coverage Goals

- **Minimum**: 80% code coverage
- **Critical paths**: 100% coverage (auth, payments, game logic)
- **Generate report**: `pnpm test:report` creates `TEST_COVERAGE.md`

### Test Best Practices

1. **No mocks for integration tests** - Use real PostgreSQL and Redis
2. **Clean state** - Each test should be independent
3. **Test real scenarios** - Simulate actual user workflows
4. **Async handling** - Properly wait for async operations
5. **Error cases** - Test both success and failure paths

## Security Considerations

1. **Never commit**:
   - `.env` files
   - `fireblocks_secret.key`
   - Any production credentials

2. **JWT Secrets**: Use strong, unique secrets in production

3. **Database**:
   - Use SSL in production
   - Limit connection pool size
   - Enable query logging for auditing

4. **API Rate Limiting**: Implemented via NestJS throttler

5. **Input Validation**: All DTOs use `class-validator` decorators

## Test Credentials

**Development/Testing Only:**

- Email: `claude@zetik.com`
- Password: `Asdf1234`

## Useful Scripts

```bash
# Create test user with 100 USDT
pnpm create-test-user

# Test house edge simulator
node test-house-edge-simulator.js

# Generate crash seed chain
pnpm generate:crash-seeds

# Check database connection
pnpm test:db

# Full development setup (all services)
./start-all-dev.sh
```

## Documentation Files

- **README.md**: Quick start guide
- **SETUP.md**: Detailed setup instructions
- **ADMIN_PANEL_SETUP.md**: Admin panel configuration
- **CRASH_GAME_DOCUMENTATION.md**: Crash game implementation
- **CRASH_PROVABLY_FAIR_IMPLEMENTATION.md**: Provably fair system
- **DOCKER_SETUP.md**: Docker deployment guide
- **TEST_COVERAGE.md**: Auto-generated test coverage report
- **PRD.md**: Product requirements document

## Important Notes

1. **Monorepo Structure**: This is a pnpm workspace with Turbo for builds
2. **Shared Libraries**: `@zetik/common` and `@zetik/shared-entities` used across apps
3. **TypeORM**: Migrations auto-run on app start (can disable in production)
4. **WebSocket**: Uses Socket.io with Redis adapter for scalability
5. **Hot Reload**: `pnpm start:dev` watches for file changes
6. **Admin Type Imports**: Admin panel imports types from main backend
7. **Package Manager**: Must use `pnpm` (version 10.15.0+)

## Troubleshooting

### Database connection failed

```bash
# Ensure PostgreSQL is running
docker-compose ps postgres
docker-compose up -d postgres

# Check connection manually
docker exec -it zetik_postgres psql -U postgres
```

### Redis connection failed

```bash
# Ensure Redis is running
docker-compose ps redis
docker-compose up -d redis

# Test connection
docker exec -it zetik_redis redis-cli ping
```

### Port already in use

```bash
# Find process using port
lsof -ti:4000

# Kill process
kill -9 $(lsof -ti:4000)
```

### Build errors after dependency changes

```bash
# Clean and reinstall
rm -rf node_modules dist
pnpm install
pnpm build
```

### Migration errors

```bash
# Revert last migration
pnpm db:migration:backend:revert

# Reset database (development only!)
docker-compose down -v
docker-compose up -d
pnpm db:migration:backend:run
```

## Getting Help

For issues or questions:

1. Check existing documentation files
2. Review test files for examples
3. Check Docker logs: `docker-compose logs -f [service]`
4. Verify environment variables are set correctly
5. Ensure all dependencies are running: `docker-compose ps`
