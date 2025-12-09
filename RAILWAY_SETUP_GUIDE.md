# Railway Deployment Step-by-Step Guide

## 📋 Prerequisites Checklist

- [ ] GitHub account created
- [ ] Code pushed to GitHub repository
- [ ] Railway account created (https://railway.app)
- [ ] $5 free monthly credit activated

## 🚀 Step-by-Step Deployment

### Step 1: Push Code to GitHub

```bash
# If you haven't already:
git init
git add .
git commit -m "Prepare for Railway deployment"

# Create GitHub repo (choose one method):

# Method 1: Using GitHub CLI
gh repo create zetik-backend --private --source=. --push

# Method 2: Manual
# 1. Go to https://github.com/new
# 2. Create a private repository named "zetik-backend"
# 3. Run:
git remote add origin https://github.com/YOUR_USERNAME/zetik-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to https://railway.app
2. Click **"Login"** → **"Login with GitHub"**
3. Authorize Railway to access your repositories
4. Click **"New Project"**
5. Click **"Deploy from GitHub repo"**
6. Select your `zetik-backend` repository

**⚠️ IMPORTANT: Don't deploy yet! Railway will try to auto-detect and deploy. Cancel it if it starts.**

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway will create a PostgreSQL instance
4. Click on the **Postgres** service card
5. Go to **"Variables"** tab
6. Note these values (you'll reference them later):
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

### Step 4: Add Redis

1. Click **"+ New"** again
2. Select **"Database"** → **"Redis"**
3. Railway will create a Redis instance
4. Click on the **Redis** service card
5. Go to **"Variables"** tab
6. Note these values:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` (may be empty)

### Step 5: Configure Main Backend Service

1. Click on your **backend service** (the GitHub repo)
2. Go to **"Settings"** tab

#### Configure Build Settings

**Root Directory**: Leave empty (uses `/`)

**Custom Start Command**: Leave empty (Dockerfile handles this)

**Dockerfile Path**: `apps/backend/Dockerfile`

#### Configure Deployment Settings

Scroll down to **"Deploy"** section:

- **Health Check Path**: `/health`
- **Health Check Timeout**: 100 seconds
- **Restart Policy**: On Failure

### Step 6: Set Environment Variables

1. Click on your backend service
2. Go to **"Variables"** tab
3. Click **"RAW Editor"** (top right)
4. **Delete everything** in the editor
5. Copy the content below and paste it:

```bash
NODE_ENV=production
PORT=4000
NODE_CLUSTER_ENABLED=false
NODE_CLUSTER_WORKERS=auto

CRASH_GAME_START_DELAY_MINUTES=1
BET_FEED_START_DELAY_MINUTES=1

# IMPORTANT: Replace with your actual frontend URL!
CORS_ORIGINS=https://pubgclash.com,https://your-frontend-url.vercel.app

# Database - Railway References
DB_HOST=${{ Postgres.PGHOST }}
DB_PORT=${{ Postgres.PGPORT }}
DB_USERNAME=${{ Postgres.PGUSER }}
DB_PASSWORD=${{ Postgres.PGPASSWORD }}
DB_DATABASE=${{ Postgres.PGDATABASE }}
DB_USERS_SCHEMA=users
DB_PAYMENTS_SCHEMA=payments
DB_BALANCE_SCHEMA=balance
DB_GAMES_SCHEMA=games
DB_BONUS_SCHEMA=bonus
DB_CHAT_SCHEMA=chat

# Redis - Railway References
REDIS_HOST=${{ Redis.REDIS_HOST }}
REDIS_PORT=${{ Redis.REDIS_PORT }}
REDIS_PASSWORD=${{ Redis.REDIS_PASSWORD }}
REDIS_DB=0

# JWT Secrets - GENERATE NEW ONES!
JWT_SECRET=REPLACE_WITH_GENERATED_SECRET
JWT_ACCESS_EXPIRATION=5d
JWT_REFRESH_SECRET=REPLACE_WITH_ANOTHER_GENERATED_SECRET
JWT_REFRESH_EXPIRATION=30d

# Social Auth
TELEGRAM_BOT_TOKEN=7938457210:AAEBAUtvbaF65Za5vWsC3B-XeG_Gp5ChKLo
GOOGLE_CLIENT_ID=800109715927-k44f8u3dn6vrlutefl0l1jdc2isuqf6a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret-here
STEAM_API_KEY=34701C04E33809FCD5DC2725DA478452
STEAM_REALM=https://api.pubgclash.com

# Fireblocks
FIREBLOCKS_API_KEY=4fed491b-f79e-41da-be74-6a26bb7d9edb
FIREBLOCKS_API_SECRET=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUpRZ0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQ1N3d2dna29BZ0VBQW9JQ0FRREc4ejNZbnBldWptRDUKNVhQSmh0NHRDS1YzSDR0eVJtbXJVSlBqdjcwdkYvRzNXZDZqc0hFc0lodmd0bVVxb1ZHZ0dEMXdxMWd4VHlBMgpkbTV1Y2hUYWNiQm13YjBuNi8zRDdBemowekpYa1BBZHVFb3pFd21zRXkwWmRmVnJFR1Z2ejcxZE5ZdE9SZ29PCkk1Sk8wcTlUVnN1Q3dOVWZNZ09CaXFGVGN4b2Z0L05hN3Njb0t3Y25XRWFXNFlWNFBkY0FMdFRIUy9URmNZbFAKODJBMWtzK0kxQTJlSmVFRUJqRjZXeDFhcUU2bnRFR216R01JVmdVM0ovVnhaK25yOHUrRzBJMkhoa3lQa3F6ZgpXRWlkL0d0ZTl3eGE1ZXEySjhlYlY3WTRLRVRGdnBtbHlwblYvbWl2RzZoUUpXQjlCYTRNYWs0bFFsOTN3UUxGCkJEQVBRbUh0bXkyWW5vQkJRWFdpYThMd21ONHhhTGVLd3ZXZE5ZT3JUdmdxempiOUkwYmpZeDdIWkVoSEZZeEYKdWROMzVWYVRxMnJoeFlYMWlBRVJCZ3ZMbTlTVVcwS2JGSTlobFlXcFAzSGltVFBxRDczTG9DWnB5OW9TTDNtQwowdnU2SGNtTERGeVcyN1gyOWVCMFA2dnZnZE16NERxWVVUeDBCbldZclRVYUNVSmgxYkNrbmlmR2VubWNsdUN1Cis1QUxoQVovMlQ2YmIrM1hONVRxcC9jYTZuR0wvWFdRWVJzak5zcXBEcGVKUzg0MzdreDNmZ1hnMnBvd0EvaWEKb3VadDhScUgwd1ErdXcvMXUwc3ZuRWNYcFRzb2hvNUFPTVdsN2lUaHhVcHo0cmpXaWY2Ly9YaFJsQ3llRmdQcQpqNWFlT2F1dk8wUEFsanFYeXptcWQ5SzNzTTM2c3dJREFRQUJBb0lDQUFQSVVCNjBOVElPWnUyWlhUQXhyanV3CjlHUmxaeU5QRDJkQWF1OWpqOWM3WDA4YkdFNklaajV1ajVVZ0lxQkMzT2hzVFk2ODB6cHN4TElFWW1rYkppWloKRHYrRkkzR0UzUmhDZnFRK09iRE1ncVF1QXNzaHk0ZEgvZzJEM3B5Z2ZTMDVCK0tqeC9nL0FLWHdLekh3YzREawpINDVtMkNaMXJ2ZGhpVnVxem81WDB2cWhtNHU1OWJMYnpNdkZrZUlOV3U4WDlOZXRMQVFzK20xWXRUV1BpdjZRCitZbE9NdzcraHlaS1lTNStFTEREanBQN1FzNi93KzJlaHQ0WEdhMXd1dmtYTWZtbnBnRDh5dWljSnhWSjNVaTYKN2JNMHQ5ZXF2ZkxJSWlERE16dUhPaWlheDMzNERrbDEveWMyN3JTeHpQTlRlaFRmUkMxa3NBYks0NWNHcmhIcgp6R1U0V3A2amMvMXd6YjVlNHNPY0w2Y2J1WEV4UjhOYVkwWGF0L2VzeGFjTlNIMUJJeDlGNHRhck1UUEVCOEZ5CkpTcXZnZU1VZzZ2cU1qVHpJa0Npcms1blRzZkJSTXRPSXNqT3B6VjErUUhLOGQzbWVXYTcwN1ZEbXRPRDloM3IKeVJuVGZIRFh2YTFvS3Zqak5EaHlWZ013RDEvQ0Qvb3VJRjdacW9GMXVST29jY3RXSjMwVFZSNFRDd1NHQk5XZApsRGdhdlNmRG5nS216WG1xNUgxRU1CMndEWjdjV3dHeU1lb1FRRXdYQlhEQzdGQUNiNjBZNVNLTExEQ0lUbnZtCmNacXcrb2hFd1lEc2F5TVNwZk13SHRnRGFMejNHbHBUd1hNMStWVnhrNXhRaVM2bmF6UElxbisrTHR6Y3pIc0sKcklkcFFnZlBieUJkazBYVUo3UVJBb0lCQVFEektLRTl3MHdSdUdCWGl3VnZHaU00SGZpWVJsdjhtVTlDYkpkdwovcE83Vk1IUDlleFE4NWs1T0J1bkh5Z1JlZlo2TDBVSXVmVnQ3WW4za0lBbW4zZ1VyQXhzeUV6eFdua1h2M2tpClJkOHo5K0FLS2w5NDNSMXJkeVR3ODNZZjFFV1JmekQyekFHTDZTVndJdnVoSi9OQ2NiZmVxOFVLbkltY2xBazUKUzlGNGJuSGhidCs5aTFISEhveUY3ZklLTWZoUW9CeUVXcEN1QXhmYkZkbENsS1NSNzA3ZFZIcXYxZ0dzYkU0ZwpLSmtHakdYMGlNL1dWVW5XS3g5d2ZGcEpKK3V4RENIYmRrY3dmRlJGNDZjRVlHNjFOcDBBbU85ei9rand3Y1dPCjU3TUdtSG41WTQyWUt6NnJzamxHdWVQTEcyaHZUendnM01xUHJ1NktINzlRWlVKbkFvSUJBUURSZE8vVDA4UGMKbXZmemcwa2lJdC80M2UyRWo5WThhdGlHZFZZanVwZEd6TVlvMDYrWVk4eDQzVXZEQTJ2dGI5UkdlWDFlbEdmNwpHbXpKQXhKNTVEVW1WK0FZaVRtZEVnRWVvMnplRVBKZkszYmxYRzZFY1A4eWRHQjlWdTVjSWhYVmQ1SW5CRENNCllFUW9vQ2h3UXZPcE1pczRHWTQ1ODA2OFIwa1pwalJGdWViUStEb3FFSTV4bm9IQ1AvcmE4Q0xHU2xMQlp6Uk0KWTc3b3k4clRZejJTc0RIZGYySGF6ei8vTitxWTRFKzlISkdxOW9GMEdrS0VkVC8yUlNld1hqb2s4b21sYVBBRwpJUnNMbHVpbzNOQm5VZHQyZXJXd0gwZ2RUOGF3a21OdDBMa0t3bGFPdTBVazBQMzhUcjl1c3RPQTJJN0dibTRDCnBLbTBQczNDVFkzVkFvSUJBUUNXZUI4SFpGSXZhUVFkU0VjdGtHUVk5dHIrQ0JRbVJReTZFdzdIK3BHYXpBRS8KV25SSlIrVWFkbkVPUXdaOWdoYVhWNmNGbG1XZEIvQm5oVUQ0SlppZVdqVTZIOTBWUWFKTG9zNG4ra3I4RXJqTwpNWmh3NTR1c0U4ZUZYM05La1FZWDJqaUhrSWlvZHJjWEpGN0lSRHVSYzJPUDVJV0RZb2o1bnRYeVljdVhGZWxjCjBrcWNOWmwrZVpZRnp0QUhwUkovZWdVTGxpdVBzeFJSRzcwZEtYU0paaWhNYUZtZmMvUUhLZUpTbml6TDA1ZkgKOGQyRFNiWHVWVE1ZWGF0Vk4rSHU1bzRSQzZsVUJLdjFyOEdMd016aFVKRnBiRHBKY2VkekRNWGUvOXhXQ1liNQpYN1NnWktwY2YyWllNUElZbnJaS295S1hSMm9GN2Y5bzgrcGtxclNqQW9JQkFHMTdnaUJuQUdtL1Z2dWlGQWdUCjBwNXk0a1A0S3pOSlpnUmlNTFJjUTladUV1WWtRQlNYbGJsWGN0SnNaMjJrbG9CLzRGZ2ZtbnBXUmFhTVJJd1MKRFBZTjJNVDZkWEwwaGtGTml3cElNV2d0ZitoRGVFRWlEMEtBTWk5UjBTVzNhMUk1UGR2SEJObGJPRVZEOGQ4OApIOERBeUhaNlpTMUZVRko1c0d3SHhDcnVFUWdKdDkxazZnL1ptbG0rdDVEWkZGUXhaVEJTa2JPY0w1M2ZhQlUyCk9ta0NVQTVIRnc4WVpZc3gzeDRwb1lSbitud3lmVmdDb2VJNnAwUkN3WXdldEtXN1lOZGxFcEVobk5GaUFCckQKME9zd2psWlByY2h4a1hCQTBzcFl1a0FjYVp5R0dGaGk2ckZqekY2bGlzcUNEcXU2aG1hU01rNlBZMlVqcnNseApZRUVDZ2dFQVRPTVNiZUdnTUdLUmNzcnVZTjh1T05iY2MyRHY0aGluOVdQcWd0ZjI3ZW9UOXVHcC9hSndjTWZvCjI2RzVJZ254VTcwOWtQUWdPdWpOZlpvcVpxVWU3TFhVMnhTcVdYRTRmODJ1K2tGWG1zeWVtZDNFVk85SnVZcWcKalFUenpVL3ZLdXBNQ2RranNCTGhsd3VKMlFSQWN3Nko3YWljQ1Y0ZlBjL3I0TUljc0NXSy9FUHNOdGF4YXZUWApNeVhvN1VKVUMrRHM1aE5xNFlaazJKa0oxTjdoWG96QUc3YkJLZGZudktNdmhLRGNzVUJSNndLQ1UzMWY3bFNZCnNGdEhQRTU1YUxRbks5VjlzZnZUV1FQVERSUXJQRFgwZG1vbEhVVGI4L0Z5L09DUEUrcVFHVXRCczB2MVpRUUsKR1B4dCttaDYzWUxGT05MbkVUN3g5L2Y3bmY5K2pnPT0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==
FIREBLOCKS_API_URL=https://sandbox-api.fireblocks.io
FIREBLOCKS_VAULT_ACCOUNT_ID=0
FIREBLOCKS_WEBHOOK_PUBLIC_KEY=replaceme
FIREBLOCKS_WEBHOOK_SANDBOX_PUBLIC_KEY=replaceme

ACTIVE_ASSETS=BTC,LTC,DOGE

ST8_API_URL=https://dgn001.o.p8d.xyz
ST8_API_PUBLIC_KEY=LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFQVpsaEwzOVpuM1pxNHBlOHZNVTREeW5ISDk3cgpMNzJzN2xDM0J4WVpmM3Viek51WTJLMUx5NEl0WFR1SkJWSVVidHozU2dBM1UyTHFZUTVZWWRhbzJnPT0KLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t
ST8_LOCAL_PRIVATE_KEY=LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IY0NBUUVFSUR6RE5QeUNnMy9vYm9IdlRvNmJRZVdvZy9KS3ZtQ2pDUHJBdFNJSkhoTGRvQW9HQ0NxR1NNNDkKQXdFSG9VUURRZ0FFa0lRb1B2amlFR0pWamY0ZEphUFVobW1aRkxSdmc0UUQyMWI3WE43QXZ4eWpIbFpPbEM2TQpwdklsaDM2Yzh6UUpWeFVZUzkvSGduUVhzRlgrYzJNUFZBPT0KLS0tLS1FTkQgRUMgUFJJVkFURSBLRVktLS0tLQo=
ST8_OPERATOR_CODE=dgn001
ST8_OPERATOR_SITE_CODE=zetik
ST8_OPERATOR_SITE=https://pubgclash.com
ST8_OPERATOR_SITE_DEPOSIT_URL=https://pubgclash.com/deposit
ST8_ASSETS_HOST=https://luckmedia.link

ST8_ASIAN_API_URL=https://dgn001.o.p8d.xyz
ST8_ASIAN_API_PUBLIC_KEY=LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFQVpsaEwzOVpuM1pxNHBlOHZNVTREeW5ISDk3cgpMNzJzN2xDM0J4WVpmM3Viek51WTJLMUx5NEl0WFR1SkJWSVVidHozU2dBM1UyTHFZUTVZWWRhbzJnPT0KLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t
ST8_ASIAN_LOCAL_PRIVATE_KEY=LS0tLS1CRUdJTiBFQyBQUklWQVRFIEtFWS0tLS0tCk1IY0NBUUVFSUR6RE5QeUNnMy9vYm9IdlRvNmJRZVdvZy9KS3ZtQ2pDUHJBdFNJSkhoTGRvQW9HQ0NxR1NNNDkKQXdFSG9VUURRZ0FFa0lRb1B2amlFR0pWamY0ZEphUFVobW1aRkxSdmc0UUQyMWI3WE43QXZ4eWpIbFpPbEM2TQpwdklsaDM2Yzh6UUpWeFVZUzkvSGduUVhzRlgrYzJNUFZBPT0KLS0tLS1FTkQgRUMgUFJJVkFURSBLRVktLS0tLQo=
ST8_ASIAN_OPERATOR_CODE=dgn001
ST8_ASIAN_OPERATOR_SITE_CODE=zetik
ST8_ASIAN_OPERATOR_SITE=https://pubgclash.com
ST8_ASIAN_OPERATOR_SITE_DEPOSIT_URL=https://pubgclash.com/deposit
ST8_ASIAN_ASSETS_HOST=https://luckmedia.link

MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=your-mailgun-domain
FRONTEND_URL=https://your-frontend-url.vercel.app
EMAIL_VERIFICATION_EXPIRATION=86400

TWILIO_ENABLED=false
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token-placeholder
TWILIO_PHONE_NUMBER=+1234567890

INTERCOM_ACCESS_TOKEN=dG9rOjQzNzU0ZmMxXzNkYTRfNGQzNF85ZGRmXzJmYTJkZWUzZjE1MDoxOjA=
INTERCOM_WEB_SECRET=4nJWEYHCKO_WAujGy6ioN9fXE2mZk0T30agkCZgO1Ek

# Skip MinIO for now (optional)
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=false
MINIO_BUCKET=zetik
PUBLIC_STORAGE_BASE_URL=

ADMIN_API_SECRET=GENERATE_STRONG_SECRET_HERE
ADMIN_ALLOWED_IPS=127.0.0.1,::1,localhost

BETBY_PUBLIC_KEY=RAW-or-BASE64-KEY
BETBY_LOCAL_PRIVATE_KEY=RAW-or-BASE64-KEY
BETBY_OPERATOR_ID=2564595874810437633
BETBY_BRAND_ID=2564595874810437634
BETBY_EXTERNAL_API_URL=https://external-api.invisiblesport.com/api/v1/external_api/
BETBY_THEME_NAME=default-table
```

6. **IMPORTANT: You MUST change these values:**

#### Generate JWT Secrets (Required!)

Run this command **twice** on your computer to generate two different secrets:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the first output and replace `REPLACE_WITH_GENERATED_SECRET` with it.
Run the command again and replace `REPLACE_WITH_ANOTHER_GENERATED_SECRET` with the second output.

Example output:

```
a3f5b8c2d1e4f7g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6
```

#### Generate Admin API Secret (Required!)

Run this command to generate admin secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Replace `GENERATE_STRONG_SECRET_HERE` with the output.

7. Click **"Update Variables"** (top right)

### Step 7: Generate Public URL

1. Go to your backend service
2. Click **"Settings"** tab
3. Scroll to **"Networking"**
4. Click **"Generate Domain"**
5. Railway will give you a URL like:
   ```
   https://zetik-backend-production.up.railway.app
   ```
6. **COPY THIS URL** - you'll need it for your frontend!

### Step 8: Update CORS_ORIGINS

Now that you have your Railway URL, update the environment variables:

1. Go back to **"Variables"** tab
2. Find `CORS_ORIGINS`
3. Update it to include your Railway backend URL and your frontend URL:
   ```
   CORS_ORIGINS=https://zetik-backend-production.up.railway.app,https://pubgclash.com,https://your-frontend-url.vercel.app
   ```
4. Click **"Update Variables"**

### Step 9: Deploy!

Railway will automatically deploy when you update variables. If not:

1. Click **"Deployments"** tab
2. Click **"Deploy"** button
3. Wait for the build to complete (3-5 minutes)

**Watch the build logs:**

- Click on the latest deployment
- Watch the **"Build Logs"** to see progress
- Once built, check **"Deploy Logs"** to see if the app started successfully

### Step 10: Verify Deployment

Once deployed, test your backend:

```bash
# Replace with your Railway URL
curl https://zetik-backend-production.up.railway.app/health
```

You should get a response like:

```json
{
  "status": "ok",
  "timestamp": "2025-12-09T12:00:00.000Z",
  "uptime": 10.5,
  "memory": {...},
  "pid": 1,
  "cluster": {
    "enabled": false,
    "workerId": null,
    "workerPid": null,
    "isWorker": false
  }
}
```

## 🎯 Connect Frontend to Backend

In your frontend `.env` file (or Vercel environment variables):

```bash
# Replace with your Railway backend URL
NEXT_PUBLIC_API_URL=https://zetik-backend-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://zetik-backend-production.up.railway.app
```

## 📊 Monitor Your Deployment

### Check Logs

1. Go to your backend service in Railway
2. Click **"Deployments"** tab
3. Click on the latest deployment
4. View **"Deploy Logs"** to see runtime logs

### Check Metrics

1. Click **"Metrics"** tab
2. See CPU usage, memory usage, and network traffic

### Check Cost

1. Go to Railway dashboard (main page)
2. Click **"Usage"** at the top
3. See your current month's usage
4. You have **$5 free credit per month**

**Expected costs for basic setup:**

- PostgreSQL: ~$1-2/month
- Redis: ~$1/month
- Backend service: ~$2-3/month
- **Total: ~$4-6/month** (within free $5 credit!)

## 🔧 Troubleshooting

### Build Failed

**Error: "Cannot find module '@zetik/common'"**

**Solution**: The Dockerfile should handle this, but if it fails:

1. Check that you pushed all code to GitHub
2. Verify `pnpm-workspace.yaml` exists in the repo
3. Check Railway build logs for specific errors

### Database Connection Failed

**Error: "Connection refused to PostgreSQL"**

**Solution**:

1. Ensure PostgreSQL service is running in Railway
2. Check variable references are correct: `${{ Postgres.PGHOST }}`
3. Verify both services are in the same Railway project

### Service Won't Start

**Check deploy logs:**

1. Go to **"Deployments"** → Latest deployment
2. Click **"Deploy Logs"**
3. Look for error messages

**Common issues:**

- Missing environment variables (check Variables tab)
- JWT secrets not generated (still showing placeholder)
- CORS_ORIGINS not updated with Railway URL

### Health Check Failing

**Error: "Health check timeout"**

**Solution**:

1. Increase health check timeout in Settings → Deploy
2. Check if migrations are taking too long (first deploy only)
3. View deploy logs to see what's happening during startup

## 🚀 Next Steps

### Optional: Deploy Microservices

If you have credit left and want to deploy additional services:

1. **Crash Service** (port 4001)
2. **Fireblocks Service** (port 4002)
3. **Bonus Service** (port 4003)
4. **Bet Feed Service** (port 4004)
5. **Race Service** (port 4005)

For each service:

- Click "+ New" → "GitHub Repo" → Select your repo
- Set Dockerfile path: `apps/[service-name]/Dockerfile`
- Copy environment variables from main backend
- Adjust PORT variable for each service

### Optional: Set Up Custom Domain

1. Go to your backend service
2. Click **"Settings"** → **"Domains"**
3. Click **"Custom Domain"**
4. Follow Railway's instructions to add DNS records

### Optional: Set Up File Storage (MinIO Alternative)

Use **Cloudflare R2** (free 10GB/month):

1. Sign up at https://dash.cloudflare.com
2. Go to **R2** → **Create bucket**
3. Get API credentials
4. Update Railway environment variables:
   ```
   MINIO_ENDPOINT=<your-account-id>.r2.cloudflarestorage.com
   MINIO_PORT=443
   MINIO_ACCESS_KEY=<your-r2-access-key>
   MINIO_SECRET_KEY=<your-r2-secret-key>
   MINIO_USE_SSL=true
   MINIO_BUCKET=zetik
   PUBLIC_STORAGE_BASE_URL=https://<your-public-url>
   ```

## 📝 Summary

**Minimum viable deployment on Railway:**

- ✅ PostgreSQL Database
- ✅ Redis Cache
- ✅ Main Backend Service
- ✅ Public URL for frontend connection
- **Cost: ~$4-6/month (within $5 free credit!)**

**You're now deployed! 🎉**

Your backend is live at: `https://your-app.up.railway.app`

Connect your frontend and start testing!
