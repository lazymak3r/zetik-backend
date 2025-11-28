# Database Migrations Usage Guide

### Creating a New Migration

To create a new migration:

```bash
pnpm migration:revert migrations/MigrationName
```

### Running Migrations

To run all pending migrations:

```bash
pnpm migration:run
```

### Reverting Migrations

To revert the most recent migration:

```bash
pnpm migration:revert
```

## How It Works

The application's data source configuration in `apps/backend/src/data-source.ts` has been modified to conditionally load migrations only when `NODE_ENV` is set to `migration`:

```typescript
migrations: process.env.NODE_ENV === 'migration' ? ['migrations/*.ts'] : [],
```

This ensures that migration files are only loaded when explicitly running migration commands, not during normal application startup.
