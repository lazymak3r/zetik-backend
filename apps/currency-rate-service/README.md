# Currency Rate Service

A cron-only NestJS microservice responsible for updating currency exchange rates.

## Overview

This service runs scheduled jobs to fetch and update currency exchange rates in the database. It does not expose any HTTP endpoints and runs in single-instance mode.

## Architecture

- **Type**: Cron-only microservice
- **Framework**: NestJS
- **Mode**: Application Context (no HTTP server)
- **Deployment**: Single instance only

## Key Features

- Runs `CurrencyRateSchedulerService` from `BalanceModule`
- Scheduled currency rate updates via cron jobs
- Graceful shutdown handling (SIGTERM/SIGINT)
- Same logging infrastructure as main backend
- Shared database and configuration with main backend

## Configuration

### Environment Variables

Create `apps/currency-rate-service/.env` based on `.env.example`:

```bash
# Service Port (not used, but required by config)
PORT=4002

# Environment
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_USERS_SCHEMA=users
DB_PAYMENTS_SCHEMA=payments
DB_BALANCE_SCHEMA=balance
DB_GAMES_SCHEMA=games
DB_BONUS_SCHEMA=bonus
DB_CHAT_SCHEMA=chat

# JWT (required by config, not used by service)
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# Service Control
CURRENCY_RATE_SERVICE_ENABLED=true
```

## Development

### Prerequisites

- Node.js >= 24.0.0
- PostgreSQL database
- pnpm package manager

### Installation

From monorepo root:

```bash
pnpm install
```

### Running the Service

```bash
# Development mode with watch
pnpm start:dev currency-rate-service

# Production mode
pnpm start:prod currency-rate-service

# Build
pnpm build currency-rate-service
```

### From Service Directory

```bash
cd apps/currency-rate-service

# Development
pnpm start:dev

# Production
pnpm start:prod

# Build
pnpm build
```

## Module Dependencies

The service imports the following modules from the main backend:

- **DatabaseModule**: Database connection and TypeORM setup
- **CommonModule**: Shared services (LoggerService, etc.)
- **BalanceModule**: Contains CurrencyRateSchedulerService

## How It Works

1. Service starts using `NestFactory.createApplicationContext()` (no HTTP server)
2. `ScheduleModule` initializes and registers all cron jobs
3. `CurrencyRateSchedulerService` runs its scheduled tasks
4. Service continues running until shutdown signal received

## Production Deployment

### Important Notes

- **Single Instance Only**: This service should run as a single instance to avoid duplicate cron job executions
- **No Load Balancer**: Does not need a load balancer (no HTTP endpoints)
- **Database Access**: Requires access to the same PostgreSQL database as main backend
- **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean shutdown

### Docker Deployment

```bash
# Build
docker build -f apps/currency-rate-service/Dockerfile -t currency-rate-service .

# Run
docker run -d \
  --name currency-rate-service \
  --env-file apps/currency-rate-service/.env \
  currency-rate-service
```

### Monitoring

Monitor the service logs for:

- Cron job execution logs
- Currency rate update success/failure
- Database connection status
- Any errors or warnings

## Troubleshooting

### Service Won't Start

1. Check database connection
2. Verify environment variables are set correctly
3. Ensure PostgreSQL schemas exist
4. Check logs for specific error messages

### Cron Jobs Not Running

1. Verify `CURRENCY_RATE_SERVICE_ENABLED=true` in environment
2. Check cron expressions in `CurrencyRateSchedulerService`
3. Review service logs for scheduler initialization

### Database Issues

1. Ensure database is accessible from service
2. Verify database credentials
3. Check that required schemas exist
4. Ensure migrations have been run

## Related Services

- **Backend**: Main casino backend API
- **Admin Panel**: Admin panel backend
- **Crash Service**: Crash game cron service
- **Fireblocks Service**: Payment processing service
- **Weekly Race Service**: Weekly race cron service

## License

UNLICENSED
