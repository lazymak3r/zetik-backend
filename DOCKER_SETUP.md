# Docker Setup for Zetik Backend Monorepo

## Overview

This monorepo includes Docker configurations for both backend and admin-panel applications, with multiple deployment options.

## Available Docker Configurations

### 1. Infrastructure Only (`docker-compose.yml`)

Located in root directory - only PostgreSQL and Redis services.

```bash
# Start only database services
docker-compose up -d
```

**Services:**

- PostgreSQL on port 5432 (configurable via `DB_PORT`)
- Redis on port 6379 (configurable via `REDIS_PORT`)

### 2. Development Environment (`dev/docker-compose.yml`)

Complete development environment with backend API, database, and analytics.

```bash
cd dev
docker-compose up -d
```

**Services:**

- PostgreSQL on port 5432
- Redis on port 26379
- Backend API on port 3100
- Metabase on port 3105

### 3. Full Applications (`dev/docker-compose.apps.yml`)

Both backend and admin-panel applications with shared infrastructure.

```bash
cd dev
docker-compose -f docker-compose.apps.yml up -d
```

**Services:**

- PostgreSQL on port 5432
- Redis on port 26379
- Backend API on port 3100
- Admin Panel on port 3101

## Individual Application Builds

### Backend

```bash
# Build backend image
docker build -f apps/backend/Dockerfile -t zetik-backend .

# Run backend container
docker run -p 3000:3000 \
  -e DB_HOST=localhost \
  -e REDIS_HOST=localhost \
  zetik-backend
```

### Admin Panel

```bash
# Build admin panel image
docker build -f apps/admin-panel/Dockerfile -t zetik-admin-panel .

# Run admin panel container
docker run -p 3001:3001 \
  -e DB_HOST=localhost \
  -e REDIS_HOST=localhost \
  zetik-admin-panel
```

## Docker Architecture

### Multi-stage Builds

Both Dockerfiles use multi-stage builds:

1. **Builder stage**: Installs all dependencies and builds the application
2. **Production stage**: Only production dependencies and built artifacts

### Monorepo Considerations

- Build context is always the root directory (`..` from dev folder)
- Dockerfiles copy workspace package.json files to install correct dependencies
- Uses npm workspaces for dependency management
- Builds specific apps using `npm run build:backend` or `npm run build:admin`

### Build Output Paths

- Backend: `dist/apps/backend/main`
- Admin Panel: `dist/apps/admin-panel/main`

## Environment Variables

### Backend Environment

Required environment variables for backend:

```
NODE_ENV=development|production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=zetik_casino
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
```

### Admin Panel Environment

Required environment variables for admin panel:

```
NODE_ENV=development|production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=zetik_casino
REDIS_HOST=localhost
REDIS_PORT=6379
ADMIN_JWT_SECRET=your-secret-key
```

## Development Workflow

### Local Development with Docker

1. Start infrastructure:

   ```bash
   docker-compose up -d
   ```

2. Run applications locally:
   ```bash
   npm run start:dev        # Backend
   npm run start:admin:dev  # Admin panel
   ```

### Full Docker Development

```bash
cd dev
docker-compose -f docker-compose.apps.yml up -d
```

Access:

- Backend API: http://localhost:3100
- Admin Panel: http://localhost:3101
- Database: localhost:5432
- Redis: localhost:26379

## Production Deployment

### Environment Files

Create `.env` files for production with real values:

```env
# Database
DB_HOST=your-db-host
DB_PASSWORD=secure-password

# JWT Secrets
JWT_SECRET=secure-random-string
ADMIN_JWT_SECRET=another-secure-string

# External Services
FIREBLOCKS_API_KEY=real-api-key
MAILGUN_API_KEY=real-mailgun-key
```

### Security Considerations

- Never commit real API keys or secrets
- Use Docker secrets for production
- Run containers as non-root user
- Use specific image tags instead of `latest`

## Troubleshooting

### Build Issues

```bash
# Clean Docker cache
docker system prune -a

# Force rebuild without cache
docker-compose build --no-cache
```

### Network Issues

```bash
# Check container connectivity
docker network ls
docker network inspect zetik-network
```

### Logs

```bash
# View application logs
docker-compose logs backend
docker-compose logs admin-panel

# Follow logs
docker-compose logs -f backend
```

## Performance Optimization

### Resource Limits

Both compose files include memory limits:

- PostgreSQL: 512MB limit, 256MB reserved
- Redis: 256MB limit, 128MB reserved

### Build Optimization

- `.dockerignore` excludes unnecessary files
- Multi-stage builds reduce final image size
- Cached layers for faster rebuilds
- Separate dependency installation from source copying
