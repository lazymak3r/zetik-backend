# Zetik Casino Backend - Setup Guide

This guide provides comprehensive instructions for setting up and running the Zetik Casino backend application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Database Setup](#database-setup)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [Development Workflow](#development-workflow)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v10 or higher) - Install with `npm install -g pnpm`
- **Docker** - [Download](https://docs.docker.com/get-docker/)
- **Docker Compose** - [Download](https://docs.docker.com/compose/install/)
- **Git** - [Download](https://git-scm.com/downloads)

## Quick Start

```bash
# 1. Clone the repository (if not already done)
git clone <repository-url>
cd zetik-backend

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp apps/backend/.env.example apps/backend/.env
cp apps/admin-panel/.env.example apps/admin-panel/.env

# 4. Start postgres and other dependencies in docker compose
docker compose up -d

# 5. Start the backend application (migrations will start automatically)
cd apps/backend
pnpm start:dev

# 6. Start admin panel backend (if needed)
cd apps/admin-panel
pnpm start:dev

# 7. Start admin panel frontend (if needed)
cd frontend/admin-panel
pnpm start
```

The backend API will be available at `http://localhost:3000/v1`

## Testing Backend (in apps/backend folder)

### Unit Tests

```bash
# Run all unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:cov
```

### End-to-End Tests

E2E tests require a running postgres and redis:

```bash
# Ensure database is running
docker compose up -d

# Run E2E tests
pnpm test:e2e

# Run one test file
pnpm test:e2e test/<filename>
```

### Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Checking Application Health

1. Check if the app is running:

   ```bash
   curl http://localhost:3000/v1/health
   ```

2. Check database connection:

   ```bash
   docker compose exec postgres pg_isready -U postgres
   ```

3. View application logs:
   ```bash
   # If running with pnpm
   pnpm start:dev
   ```

## Development Workflow

### 1. Before Starting Development

```bash
# Ensure dependencies are running
docker compose up -d

# Install/update dependencies
pnpm install
```

### 2. During Development

```bash
# Start development server
pnpm start:dev

# Run tests continuously
pnpm test:watch

# Check code quality
pnpm lint
pnpm format
```

### 3. Before Committing

```bash
# Build to ensure no compilation errors
pnpm build

# Run all tests
pnpm test
pnpm test:e2e

# Check linting
pnpm lint

# Format code
pnpm format
```

### 4. Creating New Features

1. Create feature branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Implement feature with tests

3. Run all tests:

   ```bash
   pnpm test
   pnpm run test:e2e
   ```

4. Commit and push:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin feature/your-feature-name
   ```

## Production Deployment

For production deployment:

1. Use environment-specific `.env` files
2. Set `NODE_ENV=production`
3. Use strong, unique JWT secrets
4. Configure Fireblocks with production credentials
5. Use a managed PostgreSQL instance
6. Enable SSL/TLS for all connections
7. Set up proper logging and monitoring
8. Use a process manager like PM2
