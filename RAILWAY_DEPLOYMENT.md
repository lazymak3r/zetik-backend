# Railway Deployment Guide

## Overview

This guide helps you deploy the Zetik backend to Railway with the $5/month free credit.

## Cost Estimate (Monthly)

With Railway's $5 free credit:

- **PostgreSQL**: ~$1-2/month (512MB RAM)
- **Redis**: ~$1/month (256MB RAM)
- **Main Backend**: ~$2-3/month (512MB RAM)
- **Total for basic setup**: ~$4-6/month

**Note**: You'll need to prioritize which services to deploy first. The free $5 credit should cover the main backend + database + Redis.

## Prerequisites

1. **GitHub Account**: Railway deploys from GitHub
2. **Railway Account**: Sign up at https://railway.app
3. **Push your code to GitHub**: Railway needs a Git repository

## Deployment Steps

### Step 1: Prepare Your GitHub Repository

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit for Railway deployment"

# Create GitHub repo and push
gh repo create zetik-backend --private --source=. --push
# OR manually create repo on GitHub and:
git remote add origin https://github.com/YOUR_USERNAME/zetik-backend.git
git push -u origin main
```

### Step 2: Sign Up for Railway

1. Go to https://railway.app
2. Click "Login" → Sign in with GitHub
3. Authorize Railway to access your repositories

### Step 3: Create a New Project

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your `zetik-backend` repository

### Step 4: Deploy Services in Priority Order

#### Priority 1: PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will provision a PostgreSQL instance
4. **Copy the connection details** (you'll need these for environment variables)

**Get these values from Railway:**

- `PGHOST` → Your `DB_HOST`
- `PGPORT` → Your `DB_PORT`
- `PGUSER` → Your `DB_USERNAME`
- `PGPASSWORD` → Your `DB_PASSWORD`
- `PGDATABASE` → Your `DB_DATABASE`

#### Priority 2: Redis

1. Click "+ New" again
2. Select "Database" → "Redis"
3. Railway will provision a Redis instance
4. **Copy the connection details**:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` (if provided)

#### Priority 3: Main Backend Service

1. Click "+ New"
2. Select "GitHub Repo" → Choose your repo
3. Railway will detect your `Dockerfile`
4. Configure the service:

**Root Directory**: `/`
**Dockerfile Path**: `apps/backend/Dockerfile`

**Environment Variables** (click "Variables" tab):

```bash
# Node Environment
NODE_ENV=production
PORT=4000

# Cluster Mode (disable for Railway to save resources)
NODE_CLUSTER_ENABLED=false

# Database (use Railway PostgreSQL values)
DB_HOST=${{ Postgres.PGHOST }}
DB_PORT=${{ Postgres.PGPORT }}
DB_USERNAME=${{ Postgres.PGUSER }}
DB_PASSWORD=${{ Postgres.PGPASSWORD }}
DB_DATABASE=${{ Postgres.PGDATABASE }}

# Redis (use Railway Redis values)
REDIS_HOST=${{ Redis.REDIS_HOST }}
REDIS_PORT=${{ Redis.REDIS_PORT }}
REDIS_PASSWORD=${{ Redis.REDIS_PASSWORD }}

# JWT Secrets (generate strong secrets)
JWT_SECRET=CHANGE_THIS_TO_RANDOM_STRING_Min32Chars
JWT_REFRESH_SECRET=CHANGE_THIS_TO_ANOTHER_RANDOM_STRING_Min32Chars

# Fireblocks (optional - leave empty if not using)
FIREBLOCKS_API_KEY=
FIREBLOCKS_VAULT_ACCOUNT_ID=0

# MinIO (skip for now - use Cloudflare R2 or S3 later)
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
```

**Railway Variable References:**

- Use `${{ SERVICE_NAME.VARIABLE }}` to reference variables from other services
- Example: `${{ Postgres.PGHOST }}` gets the PostgreSQL host

5. Click "Deploy"
6. Wait for build to complete (~3-5 minutes)

#### Priority 4: Microservices (Optional - deploy if you have credit left)

**Crash Service:**

- Root Directory: `/`
- Dockerfile Path: `apps/crash-service/Dockerfile`
- PORT: `4001`
- Same DB and Redis env vars as main backend

**Fireblocks Service:**

- Root Directory: `/`
- Dockerfile Path: `apps/fireblocks-service/Dockerfile`
- PORT: `4002`

**Bonus Service:**

- Root Directory: `/`
- Dockerfile Path: `apps/bonus-service/Dockerfile`
- PORT: `4003`

**Bet Feed Service:**

- Root Directory: `/`
- Dockerfile Path: `apps/bet-feed-service/Dockerfile`
- PORT: `4004`

**Race Service:**

- Root Directory: `/`
- Dockerfile Path: `apps/race-service/Dockerfile`
- PORT: `4005`

### Step 5: Generate Domain/URL

1. Go to your backend service in Railway
2. Click "Settings" tab
3. Scroll to "Networking"
4. Click "Generate Domain"
5. Railway will give you a URL like: `https://zetik-backend-production.up.railway.app`

**This is your backend API URL for the frontend!**

### Step 6: Test Your Deployment

```bash
# Check health endpoint
curl https://your-railway-url.up.railway.app/health

# Test API
curl https://your-railway-url.up.railway.app/v1/auth/health
```

### Step 7: Configure Frontend to Connect

In your frontend `.env` file:

```bash
NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_WS_URL=wss://your-railway-url.up.railway.app
```

## Important Railway-Specific Configurations

### 1. Dockerfile Optimization for Railway

Railway uses your existing Dockerfiles, but you need to ensure they're optimized for the monorepo structure.

### 2. Build Command Override (if needed)

If Railway has trouble building, you can override in `railway.json`:

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "apps/backend/Dockerfile"
  }
}
```

### 3. Health Check

Railway uses `/health` endpoint to check if your service is alive. We already have this configured.

### 4. Logs and Monitoring

- View logs: Click on your service → "Deployments" tab → Click latest deployment
- Metrics: Click "Metrics" tab to see CPU/Memory usage

## Cost Management Tips

### Start Minimal (Under $5/month)

**Phase 1 - Essential Only:**

- PostgreSQL (512MB) - $1-2
- Redis (256MB) - $1
- Main Backend (512MB) - $2-3
- **Total: ~$4-6/month**

**Phase 2 - Add Crash Service (if needed):**

- Crash Service (256MB) - $1-2
- **Total: ~$6-8/month**

### Monitor Your Usage

1. Go to Railway Dashboard
2. Check "Usage" tab
3. See current credit usage

### Prevent Overages

1. Set up usage alerts in Railway
2. Only deploy essential services initially
3. Deploy microservices later when you have budget

## Troubleshooting

### Build Fails

**Error**: "Cannot find module '@zetik/common'"

**Solution**: Railway needs to build shared libraries first. Update Dockerfile:

```dockerfile
# Build shared libraries first
RUN pnpm --filter @zetik/common build
RUN pnpm --filter @zetik/shared-entities build
```

### Service Won't Start

**Check logs:**

1. Go to service in Railway
2. Click "Deployments" → Latest deployment
3. View build and deploy logs

**Common issues:**

- Missing environment variables
- Database connection failed (check `DB_HOST` variable reference)
- Port mismatch (ensure `PORT` env var is set)

### Database Connection Errors

**Error**: "Connection refused to PostgreSQL"

**Solution**:

1. Ensure PostgreSQL service is deployed and running
2. Check environment variable references: `${{ Postgres.PGHOST }}`
3. Verify PostgreSQL is in the same project

### Out of Memory

**Error**: "Container killed (OOM)"

**Solution**:

1. Increase service memory in Railway settings
2. Disable cluster mode: `NODE_CLUSTER_ENABLED=false`
3. Optimize application memory usage

## Environment Variable Template

Copy this template for quick setup:

```bash
# Node
NODE_ENV=production
PORT=4000
NODE_CLUSTER_ENABLED=false

# Database (Railway PostgreSQL)
DB_HOST=${{ Postgres.PGHOST }}
DB_PORT=${{ Postgres.PGPORT }}
DB_USERNAME=${{ Postgres.PGUSER }}
DB_PASSWORD=${{ Postgres.PGPASSWORD }}
DB_DATABASE=${{ Postgres.PGDATABASE }}

# Redis (Railway Redis)
REDIS_HOST=${{ Redis.REDIS_HOST }}
REDIS_PORT=${{ Redis.REDIS_PORT }}
REDIS_PASSWORD=${{ Redis.REDIS_PASSWORD }}

# JWT (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters-long

# Optional Services
FIREBLOCKS_API_KEY=
FIREBLOCKS_VAULT_ACCOUNT_ID=0
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
```

## Next Steps After Deployment

1. **Generate JWT Secrets**: Use a secure random generator

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Run Migrations**: They should auto-run on startup, but verify in logs

3. **Create Admin User**: Use the seed script or manually create

4. **Test API Endpoints**: Use Postman or curl

5. **Connect Frontend**: Update frontend `.env` with Railway URL

6. **Set up Custom Domain** (optional): Railway supports custom domains

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- GitHub Issues: Your repository issues

## Summary

**Minimum Deployment (Under $5/month):**

- ✅ PostgreSQL
- ✅ Redis
- ✅ Main Backend

**Full Deployment (~$20-30/month):**

- ✅ All above +
- ✅ Crash Service
- ✅ Fireblocks Service
- ✅ Bonus Service
- ✅ Bet Feed Service
- ✅ Race Service

**Start with minimum deployment, then scale up as needed!**
