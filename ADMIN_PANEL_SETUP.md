# Admin Panel Setup & Configuration

## Overview

The admin panel has been successfully migrated to the monorepo structure with proper environment variable validation and configuration management. **The admin panel uses its own local `.env` file located at `apps/admin-panel/.env`**.

## Environment Variables Setup

### 1. Backend Configuration

Backend uses all database schemas **except** `admin`:

- Schemas: `public`, `users`, `payments`, `balance`, `bonus`, `games`
- Configuration: `apps/backend/src/data-source.ts` with `searchPath` exclusion

### 2. Admin Panel Configuration

Admin panel uses **only** the `admin` schema:

- Schema: `admin`
- **Local .env file**: `apps/admin-panel/.env`
- Separate JWT secrets and configuration
- Independent port (3001 vs 3000 for backend)

### 3. Setup Instructions

**Step 1: Create Admin Panel .env file**

```bash
# Copy the example file
cp apps/admin-panel/.env.example apps/admin-panel/.env

# Edit the file with your values
nano apps/admin-panel/.env
```

**Step 2: Configure Backend .env (if needed)**

```bash
# Backend uses root .env or apps/backend/.env
cp apps/backend/.env.example apps/backend/.env
```

### 4. Admin Panel .env File

The admin panel reads environment variables from `apps/admin-panel/.env`:

```bash
# Admin Panel Configuration
ADMIN_PORT=3001
NODE_ENV=development

# CORS Configuration
ADMIN_CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres

# JWT Configuration for Admin Panel
ADMIN_JWT_SECRET=admin-secret-key-dev
ADMIN_JWT_ACCESS_EXPIRATION=8h
ADMIN_JWT_REFRESH_SECRET=admin-refresh-secret-key-dev
ADMIN_JWT_REFRESH_EXPIRATION=7d

# Default Admin Credentials
DEFAULT_ADMIN_EMAIL=admin@zetik.casino
DEFAULT_ADMIN_PASSWORD=changeme1234
DEFAULT_ADMIN_NAME=Administrator

# Session Configuration
ADMIN_SESSION_SECRET=admin-session-secret-dev
ADMIN_SESSION_EXPIRATION=3600

# Security Configuration
ADMIN_BCRYPT_ROUNDS=12
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOGIN_LOCKOUT_DURATION=900

# Rate Limiting
ADMIN_RATE_LIMIT_TTL=60
ADMIN_RATE_LIMIT_LIMIT=100
```

## Environment Variable Validation

Both applications now use `env-var` library for validation:

### Backend Validation

- Located in `apps/backend/src/config/`
- Validates database, JWT, mail, fireblocks, etc.
- Throws errors for missing required variables

### Admin Panel Validation

- Located in `apps/admin-panel/src/config/`
- Validates admin-specific configuration
- Type checking and default values
- **Reads from `apps/admin-panel/.env`**

### Required Variables

**Admin Panel** (in `apps/admin-panel/.env`):

- `DB_PASSWORD`
- `ADMIN_JWT_SECRET`
- `ADMIN_JWT_REFRESH_SECRET`
- `ADMIN_SESSION_SECRET`

## Database Schema Separation

### Backend Database Access

```typescript
// apps/backend/src/data-source.ts
extra: {
  searchPath: 'public,users,payments,balance,bonus,games',
}
```

### Admin Panel Database Access

```typescript
// apps/admin-panel/src/config/database.config.ts
schema: 'admin',
entities: [AdminEntity],
```

## Running Applications

### Development Mode

```bash
# Start backend only
pnpm start:dev

# Start admin panel only
pnpm start:admin:dev

# Start both applications
pnpm start:all:dev
```

### Production Mode

```bash
# Start backend
pnpm start:backend:prod

# Start admin panel
pnpm start:admin:prod
```

### Ports

- **Backend**: `http://localhost:3000`
- **Admin Panel**: `http://localhost:3001`

## Default Admin Account

On first startup, admin panel creates:

- **Email**: `admin@zetik.casino`
- **Password**: `changeme123`
- **Role**: `super_admin`

**⚠️ Change password immediately after first login!**

## API Documentation

- **Backend Swagger**: `http://localhost:3000/v1/docs`
- **Admin Panel Swagger**: `http://localhost:3001/api-docs`

## Configuration Files Structure

```
apps/
├── backend/
│   ├── .env.example
│   └── src/config/
│       ├── common.config.ts
│       ├── database.config.ts
│       ├── jwt.config.ts
│       ├── mail.config.ts
│       └── fireblocks.config.ts
└── admin-panel/
    ├── .env                  # ← Local environment file (created by you)
    ├── .env.example          # ← Template file
    ├── README.md
    └── src/config/
        ├── admin.config.ts
        ├── database.config.ts
        └── jwt.config.ts
```

## Environment File Loading

The admin panel uses the following priority for loading environment files:

1. `apps/admin-panel/.env` (primary)
2. `.env` (fallback)

This is configured in `apps/admin-panel/src/admin-panel.module.ts`:

```typescript
ConfigModule.forRoot({
  envFilePath: ['apps/admin-panel/.env', '.env'],
  // ...
});
```

## Security Features

### Admin Panel Security

- JWT authentication with refresh tokens
- BCrypt password hashing (configurable rounds)
- Rate limiting
- CORS protection
- Session management
- Login attempt limiting with lockout

### Environment Security

- All secrets validated at startup
- Type checking for all variables
- Required variable enforcement
- Separate secrets for backend and admin
- **Local .env file for admin panel isolation**

## Troubleshooting

### Common Issues

1. **Admin Panel Won't Start**

   ```bash
   # Check if .env file exists
   ls -la apps/admin-panel/.env

   # Create from example if missing
   cp apps/admin-panel/.env.example apps/admin-panel/.env
   ```

2. **Environment Variables Not Found**

   ```bash
   # Check admin panel .env file content
   grep "ADMIN_JWT_SECRET" apps/admin-panel/.env
   ```

3. **Database Connection Failed**

   ```bash
   # Check variables in admin panel .env
   grep "DB_" apps/admin-panel/.env
   ```

4. **Port Conflicts**
   ```bash
   # Check if ports are in use
   lsof -i :3000
   lsof -i :3001
   ```

### Validation Errors

Environment validation errors will show:

- Missing required variables
- Invalid types or formats
- Enum validation failures

Example error:

```
EnvVarError: env-var: "ADMIN_JWT_SECRET" is a required variable, but it was not set
```

**Solution**: Add the missing variable to `apps/admin-panel/.env`

## Migration Checklist

✅ **Completed:**

- [x] Monorepo structure created
- [x] Admin panel migrated to `apps/admin-panel/`
- [x] Environment variable validation added
- [x] Database schema separation configured
- [x] JWT configuration separated
- [x] Default admin seeding implemented
- [x] Documentation created
- [x] Build scripts updated
- [x] Both applications compile successfully
- [x] **Local .env file support for admin panel**

✅ **Configuration Files:**

- [x] `apps/admin-panel/.env.example`
- [x] `apps/admin-panel/README.md`
- [x] Environment validation in all configs
- [x] Proper TypeScript types
- [x] Linting compliance
- [x] **Local .env file loading**

✅ **Testing:**

- [x] Backend builds successfully
- [x] Admin panel builds successfully
- [x] Environment validation works
- [x] Configuration loading works
- [x] **Admin panel starts with local .env**

## Next Steps

1. **Setup Admin Panel Environment**:

   ```bash
   cp apps/admin-panel/.env.example apps/admin-panel/.env
   # Edit apps/admin-panel/.env with your values
   ```

2. **Database Setup**: Ensure PostgreSQL is running with correct credentials

3. **First Run**: `npm run start:admin:dev`

4. **Security**: Change default admin password

5. **Production**: Configure production environment variables

## Support

For issues:

1. Check `apps/admin-panel/.env` file exists and has correct values
2. Verify admin panel specific environment variables
3. Check application logs for validation errors
4. Ensure database connectivity with admin schema access
