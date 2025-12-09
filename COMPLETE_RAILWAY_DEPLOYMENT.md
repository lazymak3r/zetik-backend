# Complete Railway Deployment Guide (All Services)

## 🎯 Deployment Strategy

### On Railway (Backend services):

1. ✅ **PostgreSQL Database** (~$1-2/month)
2. ✅ **Redis Cache** (~$1/month)
3. ✅ **Main Backend API** (~$2-3/month) - `apps/backend`
4. ⚠️ **Admin Panel Backend API** (~$1-2/month) - `apps/admin-panel` (Optional - may exceed $5 credit)

### On Vercel/Netlify (Frontend - FREE):

5. ✅ **Admin Panel Frontend** - `frontend/admin-panel` (React app)

**Estimated Total on Railway**: $4-8/month

---

## 📋 Complete Environment Variables (All Services Combined)

Based on all your `.env` files, here's the **COMPLETE** configuration for Railway:

### Main Backend Service Environment Variables

```bash
# ==========================================
# Node Environment
# ==========================================
NODE_ENV=production
PORT=4000

# ==========================================
# Cluster Mode
# ==========================================
NODE_CLUSTER_ENABLED=false
NODE_CLUSTER_WORKERS=auto

# ==========================================
# Game Configuration
# ==========================================
CRASH_GAME_START_DELAY_MINUTES=1
BET_FEED_START_DELAY_MINUTES=1

# ==========================================
# CORS Origins (UPDATE WITH YOUR RAILWAY + VERCEL URLS!)
# ==========================================
CORS_ORIGINS=http://localhost:3000,http://localhost:3002,https://5.199.168.142:5000,https://5.199.168.142,https://pubgclash.com,https://YOUR_RAILWAY_BACKEND_URL.up.railway.app,https://YOUR_VERCEL_ADMIN_URL.vercel.app

# ==========================================
# Database (Railway PostgreSQL)
# ==========================================
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

# ==========================================
# Redis (Railway Redis)
# ==========================================
REDIS_HOST=${{ Redis.REDIS_HOST }}
REDIS_PORT=${{ Redis.REDIS_PORT }}
REDIS_PASSWORD=${{ Redis.REDIS_PASSWORD }}
REDIS_DB=0

# ==========================================
# JWT Secrets (GENERATE NEW ONES!)
# ==========================================
JWT_SECRET=[GENERATE_64_BYTE_HEX]
JWT_ACCESS_EXPIRATION=5d
JWT_REFRESH_SECRET=[GENERATE_64_BYTE_HEX]
JWT_REFRESH_EXPIRATION=30d

# ==========================================
# Social Auth (Your existing values)
# ==========================================
TELEGRAM_BOT_TOKEN=7938457210:AAEBAUtvbaF65Za5vWsC3B-XeG_Gp5ChKLo
GOOGLE_CLIENT_ID=800109715927-k44f8u3dn6vrlutefl0l1jdc2isuqf6a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret-here
STEAM_API_KEY=34701C04E33809FCD5DC2725DA478452
STEAM_REALM=https://api.pubgclash.com

# ==========================================
# Fireblocks (Your existing values)
# ==========================================
FIREBLOCKS_API_KEY=4fed491b-f79e-41da-be74-6a26bb7d9edb
FIREBLOCKS_API_SECRET=LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCk1JSUpRZ0lCQURBTkJna3Foa2lHOXcwQkFRRUZBQVNDQ1N3d2dna29BZ0VBQW9JQ0FRREc4ejNZbnBldWptRDUKNVhQSmh0NHRDS1YzSDR0eVJtbXJVSlBqdjcwdkYvRzNXZDZqc0hFc0lodmd0bVVxb1ZHZ0dEMXdxMWd4VHlBMgpkbTV1Y2hUYWNiQm13YjBuNi8zRDdBemowekpYa1BBZHVFb3pFd21zRXkwWmRmVnJFR1Z2ejcxZE5ZdE9SZ29PCkk1Sk8wcTlUVnN1Q3dOVWZNZ09CaXFGVGN4b2Z0L05hN3Njb0t3Y25XRWFXNFlWNFBkY0FMdFRIUy9URmNZbFAKODJBMWtzK0kxQTJlSmVFRUJqRjZXeDFhcUU2bnRFR216R01JVmdVM0ovVnhaK25yOHUrRzBJMkhoa3lQa3F6ZgpXRWlkL0d0ZTl3eGE1ZXEySjhlYlY3WTRLRVRGdnBtbHlwblYvbWl2RzZoUUpXQjlCYTRNYWs0bFFsOTN3UUxGCkJEQVBRbUh0bXkyWW5vQkJRWFdpYThMd21ONHhhTGVLd3ZXZE5ZT3JUdmdxempiOUkwYmpZeDdIWkVoSEZZeEYKdWROMzVWYVRxMnJoeFlYMWlBRVJCZ3ZMbTlTVVcwS2JGSTlobFlXcFAzSGltVFBxRDczTG9DWnB5OW9TTDNtQwowdnU2SGNtTERGeVcyN1gyOWVCMFA2dnZnZE16NERxWVVUeDBCbldZclRVYUNVSmgxYkNrbmlmR2VubWNsdUN1Cis1QUxoQVovMlQ2YmIrM1hONVRxcC9jYTZuR0wvWFdRWVJzak5zcXBEcGVKUzg0MzdreDNmZ1hnMnBvd0EvaWEKb3VadDhScUgwd1ErdXcvMXUwc3ZuRWNYcFRzb2hvNUFPTVdsN2lUaHhVcHo0cmpXaWY2Ly9YaFJsQ3llRmdQcQpqNWFlT2F1dk8wUEFsanFYeXptcWQ5SzNzTTM2c3dJREFRQUJBb0lDQUFQSVVCNjBOVElPWnUyWlhUQXhyanV3CjlHUmxaeU5QRDJkQWF1OWpqOWM3WDA4YkdFNklaajV1ajVVZ0lxQkMzT2hzVFk2ODB6cHN4TElFWW1rYkppWloKRHYrRkkzR0UzUmhDZnFRK09iRE1ncVF1QXNzaHk0ZEgvZzJEM3B5Z2ZTMDVCK0tqeC9nL0FLWHdLekh3YzREawpINDVtMkNaMXJ2ZGhpVnVxem81WDB2cWhtNHU1OWJMYnpNdkZrZUlOV3U4WDlOZXRMQVFzK20xWXRUV1BpdjZRCitZbE9NdzcraHlaS1lTNStFTEREanBQN1FzNi93KzJlaHQ0WEdhMXd1dmtYTWZtbnBnRDh5dWljSnhWSjNVaTYKN2JNMHQ5ZXF2ZkxJSWlERE16dUhPaWlheDMzNERrbDEveWMyN3JTeHpQTlRlaFRmUkMxa3NBYks0NWNHcmhIcgp6R1U0V3A2amMvMXd6YjVlNHNPY0w2Y2J1WEV4UjhOYVkwWGF0L2VzeGFjTlNIMUJJeDlGNHRhck1UUEVCOEZ5CkpTcXZnZU1VZzZ2cU1qVHpJa0Npcms1blRzZkJSTXRPSXNqT3B6VjErUUhLOGQzbWVXYTcwN1ZEbXRPRDloM3IKeVJuVGZIRFh2YTFvS3Zqak5EaHlWZ013RDEvQ0Qvb3VJRjdacW9GMXVST29jY3RXSjMwVFZSNFRDd1NHQk5XZApsRGdhdlNmRG5nS216WG1xNUgxRU1CMndEWjdjV3dHeU1lb1FRRXdYQlhEQzdGQUNiNjBZNVNLTExEQ0lUbnZtCmNacXcrb2hFd1lEc2F5TVNwZk13SHRnRGFMejNHbHBUd1hNMStWVnhrNXhRaVM2bmF6UElxbisrTHR6Y3pIc0sKcklkcFFnZlBieUJkazBYVUo3UVJBb0lCQVFEektLRTl3MHdSdUdCWGl3VnZHaU00SGZpWVJsdjhtVTlDYkpkdwovcE83Vk1IUDlleFE4NWs1T0J1bkh5Z1JlZlo2TDBVSXVmVnQ3WW4za0lBbW4zZ1VyQXhzeUV6eFdua1h2M2tpClJkOHo5K0FLS2w5NDNSMXJkeVR3ODNZZjFFV1JmekQyekFHTDZTVndJdnVoSi9OQ2NiZmVxOFVLbkltY2xBazUKUzlGNGJuSGhidCs5aTFISEhveUY3ZklLTWZoUW9CeUVXcEN1QXhmYkZkbENsS1NSNzA3ZFZIcXYxZ0dzYkU0ZwpLSmtHakdYMGlNL1dWVW5XS3g5d2ZGcEpKK3V4RENIYmRrY3dmRlJGNDZjRVlHNjFOcDBBbU85ei9land3Y1dPCjU3TUdtSG41WTQyWUt6NnJzamxHdWVQTEcyaHZUendnM01xUHJ1NktINzlRWlVKbkFvSUJBUURSZE8vVDA4UGMKbXZmemcwa2lJdC80M2UyRWo5WThhdGlHZFZZanVwZEd6TVlvMDYrWVk4eDQzVXZEQTJ2dGI5UkdlWDFlbEdmNwpHbXpKQXhKNTVEVW1WK0FZaVRtZEVnRWVvMnplRVBKZkszYmxYRzZFY1A4eWRHQjlWdTVjSWhYVmQ1SW5CRENNCllFUW9vQ2h3UXZPcE1pczRHWTQ1ODA2OFIwa1pwalJGdWViUStEb3FFSTV4bm9IQ1AvcmE4Q0xHU2xMQlp6Uk0KWTc3b3k4clRZejJTc0RIZGYySGF6ei8vTitxWTRFKzlISkdxOW9GMEdrS0VkVC8yUlNld1hqb2s4b21sYVBBRwpJUnNMbHVpbzNOQm5VZHQyZXJXd0gwZ2RUOGF3a21OdDBMa0t3bGFPdTBVazBQMzhUcjl1c3RPQTJJN0dibTRDCnBLbTBQczNDVFkzVkFvSUJBUUNXZUI4SFpGSXZhUVFkU0VjdGtHUVk5dHIrQ0JRbVJReTZFdzdIK3BHYXpBRS8KV25SSlIrVWFkbkVPUXdaOWdoYVhWNmNGbG1XZEIvQm5oVUQ0SlppZVdqVTZIOTBWUWFKTG9zNG4ra3I4RXJqTwpNWmh3NTR1c0U4ZUZYM05La1FZWDJqaUhrSWlvZHJjWEpGN0lSRHVSYzJPUDVJV0RZb2o1bnRYeVljdVhGZWxjCjBrcWNOWmwrZVpZRnp0QUhwUkovZWdVTGxpdVBzeFJSRzcwZEtYU0paaWhNYUZtZmMvUUhLZUpTbml6TDA1ZkgKOGQyRFNiWHVWVE1ZWGF0Vk4rSHU1bzRSQzZsVUJLdjFyOEdMd016aFVKRnBiRHBKY2VkekRNWGUvOXhXQ1liNQpYN1NnWktwY2YyWllNUElZbnJaS295S1hSMm9GN2Y5bzgrcGtxclNqQW9JQkFHMTdnaUJuQUdtL1Z2dWlGQWdUCjBwNXk0a1A0S3pOSlpnUmlNTFJjUTladUV1WWtRQlNYbGJsWGN0SnNaMjJrbG9CLzRGZ2ZtbnBXUmFhTVJJd1MKRFBZTjJNVDZkWEwwaGtGTml3cElNV2d0ZitoRGVFRWlEMEtBTWk5UjBTVzNhMUk1UGR2SEJObGJPRVZEOGQ4OApIOERBeUhaNlpTMUZVRko1c0d3SHhDcnVFUWdKdDkxazZnL1ptbG0rdDVEWkZGUXhaVEJTa2JPY0w1M2ZhQlUyCk9ta0NVQTVIRnc4WVpZc3gzeDRwb1lSbitud3lmVmdDb2VJNnAwUkN3WXdldEtXN1lOZGxFcEVobk5GaUFCckQKME9zd2psWlByY2h4a1hCQTBzcFl1a0FjYVp5R0dGaGk2ckZqekY2bGlzcUNEcXU2aG1hU01rNlBZMlVqcnNseApZRUVDZ2dFQVRPTVNiZUdnTUdLUmNzcnVZTjh1T05iY2MyRHY0aGluOVdQcWd0ZjI3ZW9UOXVHcC9hSndjTWZvCjI2RzVJZ254VTcwOWtQUWdPdWpOZlpvcVpxVWU3TFhVMnhTcVdYRTRmODJ1K2tGWG1zeWVtZDNFVk85SnVZcWcKalFUenpVL3ZLdXBNQ2RranNCTGhsd3VKMlFSQWN3Nko3YWljQ1Y0ZlBjL3I0TUljc0NXSy9FUHNOdGF4YXZUWApNeVhvN1VKVUMrRHM1aE5xNFlaazJKa0oxTjdoWG96QUc3YkJLZGZudktNdmhLRGNzVUJSNndLQ1UzMWY3bFNZCnNGdEhQRTU1YUxRbks5VjlzZnZUV1FQVERSUXJQRFgwZG1vbEhVVGI4L0Z5L09DUEUrcVFHVXRCczB2MVpRUUsKR1B4dCttaDYzWUxGT05MbkVUN3g5L2Y3bmY5K2pnPT0KLS0tLS1FTkQgUFJJVkFURSBLRVktLS0tLQ==
FIREBLOCKS_API_URL=https://sandbox-api.fireblocks.io
FIREBLOCKS_VAULT_ACCOUNT_ID=0
FIREBLOCKS_WEBHOOK_PUBLIC_KEY=replaceme
FIREBLOCKS_WEBHOOK_SANDBOX_PUBLIC_KEY=replaceme

ACTIVE_ASSETS=BTC,LTC,DOGE

# ==========================================
# ST8 Integration (Your existing values)
# ==========================================
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

# ==========================================
# Email (Mailgun)
# ==========================================
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_DOMAIN=your-mailgun-domain
FRONTEND_URL=https://YOUR_RAILWAY_BACKEND_URL.up.railway.app
EMAIL_VERIFICATION_EXPIRATION=86400

# ==========================================
# Twilio (Optional)
# ==========================================
TWILIO_ENABLED=false
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token-placeholder
TWILIO_PHONE_NUMBER=+1234567890

# ==========================================
# Intercom (Your existing values)
# ==========================================
INTERCOM_ACCESS_TOKEN=dG9rOjQzNzU0ZmMxXzNkYTRfNGQzNF85ZGRmXzJmYTJkZWUzZjE1MDoxOjA=
INTERCOM_WEB_SECRET=4nJWEYHCKO_WAujGy6ioN9fXE2mZk0T30agkCZgO1Ek

# ==========================================
# File Storage (MinIO - YOUR PRODUCTION SERVER!)
# ==========================================
# ✅ You already have production MinIO configured!
MINIO_ENDPOINT=minio-api.playbitz.com
MINIO_PORT=443
MINIO_ACCESS_KEY=Q08xW6yDk5bfQT9OvJgm
MINIO_SECRET_KEY=K9zT7Dv4TeRpQ8N1XMv5CuW0x08bQq
MINIO_USE_SSL=true
MINIO_BUCKET=zetik
PUBLIC_STORAGE_BASE_URL=https://minio-api.playbitz.com/zetik

# ==========================================
# Admin Panel Access (YOUR PRODUCTION VALUES!)
# ==========================================
# ✅ You already have this generated!
ADMIN_API_SECRET=cb200ea24c111fc10b2320acf37f84bde5b1125548728bc8115f4923d9723557d01ba0d33092e4f34a8902b52c4cb478c88faef5260b792d900c627cd8169d29
ADMIN_ALLOWED_IPS=127.0.0.1,localhost,84.32.51.88

# ==========================================
# Exchange Rate API (From root .env)
# ==========================================
EXCHANGE_RATE_URL=https://v6.exchangerate-api.com/v6/913a5bfc4e1b36edb05dcdc3/latest/USD
EXCHANGE_RATE_RELOAD_HOURS=12

# ==========================================
# BETBY Sportsbook
# ==========================================
BETBY_PUBLIC_KEY=RAW-or-BASE64-KEY
BETBY_LOCAL_PRIVATE_KEY=RAW-or-BASE64-KEY
BETBY_OPERATOR_ID=2564595874810437633
BETBY_BRAND_ID=2564595874810437634
BETBY_EXTERNAL_API_URL=https://external-api.invisiblesport.com/api/v1/external_api/
BETBY_THEME_NAME=default-table
```

### Admin Panel Backend Service (Optional)

If you want to deploy admin panel backend separately:

```bash
# ==========================================
# Admin Panel Configuration
# ==========================================
ADMIN_PORT=3001
NODE_ENV=production

# ==========================================
# CORS (UPDATE WITH YOUR VERCEL ADMIN URL!)
# ==========================================
ADMIN_CORS_ORIGINS=https://YOUR_ADMIN_PANEL_FRONTEND.vercel.app,https://admin.pubgclash.com

# ==========================================
# Database (Same Railway PostgreSQL)
# ==========================================
DB_HOST=${{ Postgres.PGHOST }}
DB_PORT=${{ Postgres.PGPORT }}
DB_USERNAME=${{ Postgres.PGUSER }}
DB_PASSWORD=${{ Postgres.PGPASSWORD }}
DB_DATABASE=${{ Postgres.PGDATABASE }}
DB_ADMIN_SCHEMA=admin

# ==========================================
# JWT (GENERATE NEW ADMIN SECRETS!)
# ==========================================
ADMIN_JWT_SECRET=[GENERATE_32_BYTE_HEX]
ADMIN_JWT_ACCESS_EXPIRATION=8h
ADMIN_JWT_REFRESH_SECRET=[GENERATE_32_BYTE_HEX]
ADMIN_JWT_REFRESH_EXPIRATION=7d

# ==========================================
# Default Admin Credentials
# ==========================================
DEFAULT_ADMIN_EMAIL=admin@zetik.casino
DEFAULT_ADMIN_PASSWORD=changeme123
DEFAULT_ADMIN_NAME=Administrator

# ==========================================
# Session Configuration
# ==========================================
ADMIN_SESSION_SECRET=[GENERATE_32_BYTE_HEX]
ADMIN_SESSION_EXPIRATION=3600

# ==========================================
# Security
# ==========================================
ADMIN_BCRYPT_ROUNDS=12
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_LOGIN_LOCKOUT_DURATION=900

# ==========================================
# Rate Limiting
# ==========================================
ADMIN_RATE_LIMIT_TTL=60
ADMIN_RATE_LIMIT_LIMIT=100

# ==========================================
# MinIO (Same as main backend)
# ==========================================
MINIO_ENDPOINT=minio-api.playbitz.com
MINIO_PORT=443
MINIO_ACCESS_KEY=Q08xW6yDk5bfQT9OvJgm
MINIO_SECRET_KEY=K9zT7Dv4TeRpQ8N1XMv5CuW0x08bQq
MINIO_USE_SSL=true
MINIO_BUCKET=zetik
PUBLIC_STORAGE_BASE_URL=https://minio-api.playbitz.com/zetik

# ==========================================
# Backend Access
# ==========================================
BACKEND_URL=https://YOUR_MAIN_BACKEND_RAILWAY_URL.up.railway.app
ADMIN_API_SECRET=cb200ea24c111fc10b2320acf37f84bde5b1125548728bc8115f4923d9723557d01ba0d33092e4f34a8902b52c4cb478c88faef5260b792d900c627cd8169d29
```

---

## 🚀 Deployment Steps

### Phase 1: Main Backend Only (Recommended - Under $5)

Deploy just the main backend first to stay within free credit:

**On Railway:**

1. PostgreSQL Database
2. Redis Cache
3. Main Backend Service (`apps/backend`)

**Cost**: ~$4-6/month ✅ Within $5 free credit!

### Phase 2: Add Admin Panel Backend (Optional - $6-8 total)

If you need the admin panel and can afford $6-8/month:

**On Railway:** 4. Admin Panel Backend Service (`apps/admin-panel`)

**Cost**: ~$6-8/month ⚠️ Exceeds free credit by $1-3

### Phase 3: Deploy Frontend (FREE!)

**On Vercel (free tier):**

- Admin Panel Frontend (`frontend/admin-panel`)

**Cost**: FREE ✅

---

## 📦 Step-by-Step Railway Deployment

### 1. Generate Secrets

Run these commands to generate required secrets:

```bash
# JWT_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ADMIN_JWT_SECRET (32 bytes) - if deploying admin panel
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ADMIN_JWT_REFRESH_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ADMIN_SESSION_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Prepare for Railway deployment"
git push
```

### 3. Create Railway Project

1. Go to https://railway.app
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository

### 4. Add PostgreSQL

1. Click "+ New"
2. Select "Database" → "PostgreSQL"
3. Wait for provisioning

### 5. Add Redis

1. Click "+ New"
2. Select "Database" → "Redis"
3. Wait for provisioning

### 6. Configure Main Backend

1. Click on your backend service (GitHub repo)
2. Go to "Settings"
3. Set **Dockerfile Path**: `apps/backend/Dockerfile`
4. Set **Health Check Path**: `/health`
5. Go to "Variables" tab
6. Click "RAW Editor"
7. **Copy the COMPLETE environment variables from above** (Main Backend section)
8. **Replace placeholders:**
   - `[GENERATE_64_BYTE_HEX]` with generated JWT secrets
   - `YOUR_RAILWAY_BACKEND_URL` with your Railway domain (generate it first)
   - `YOUR_VERCEL_ADMIN_URL` with your Vercel domain (after deploying frontend)

### 7. Generate Domain

1. Go to "Settings" → "Networking"
2. Click "Generate Domain"
3. Copy your URL: `https://zetik-backend-production.up.railway.app`
4. Update CORS_ORIGINS and FRONTEND_URL with this URL

### 8. Deploy!

Railway will auto-deploy. Watch the logs in "Deployments" tab.

---

## 🎨 Deploy Admin Panel Frontend to Vercel (FREE)

### 1. Update Frontend Environment Variables

Create `frontend/admin-panel/.env.production`:

```bash
REACT_APP_API_URL=https://YOUR_RAILWAY_ADMIN_BACKEND_URL.up.railway.app/v1
PUBLIC_STORAGE_BASE_URL=https://minio-api.playbitz.com/zetik
```

### 2. Push to GitHub

```bash
git add .
git commit -m "Update admin panel env for production"
git push
```

### 3. Deploy to Vercel

1. Go to https://vercel.com
2. Sign in with GitHub
3. Click "New Project"
4. Select your repository
5. Set **Root Directory**: `frontend/admin-panel`
6. Set **Framework Preset**: Create React App
7. Add environment variables:
   - `REACT_APP_API_URL`: Your Railway admin backend URL
   - `PUBLIC_STORAGE_BASE_URL`: `https://minio-api.playbitz.com/zetik`
8. Click "Deploy"

---

## ✅ What You Already Have (Good News!)

You don't need to worry about these:

✅ **MinIO Storage**: Already configured at `minio-api.playbitz.com`
✅ **Admin API Secret**: Already generated
✅ **Exchange Rate API**: Already configured
✅ **Social Auth Tokens**: Already set up (Telegram, Google, Steam)
✅ **Payment Integration**: Fireblocks already configured

---

## 💰 Cost Breakdown

### Minimum Deployment (Main Backend Only):

- PostgreSQL: $1-2/month
- Redis: $1/month
- Main Backend: $2-3/month
- **Total: $4-6/month** ✅ Within $5 credit!

### Full Deployment (Main + Admin Backend):

- PostgreSQL: $1-2/month
- Redis: $1/month
- Main Backend: $2-3/month
- Admin Backend: $1-2/month
- **Total: $6-8/month** ⚠️ $1-3 over budget

### Frontend:

- Vercel: FREE ✅

---

## 🎯 My Recommendation

### Start with Phase 1:

Deploy **only main backend** on Railway ($4-6/month):

- ✅ Main casino API
- ✅ All games working
- ✅ User registration/login
- ✅ Payments via Fireblocks
- ✅ File uploads via your MinIO server

### Access admin panel locally:

Run admin panel locally during development:

```bash
cd apps/admin-panel
pnpm start:dev  # Runs on localhost:3001
```

### Later (when you have budget):

Deploy admin panel backend + frontend when needed.

---

## 🔗 Final URLs Structure

After deployment:

- **Main Backend API**: `https://zetik-backend.up.railway.app`
- **Admin Backend API**: `https://zetik-admin.up.railway.app` (optional)
- **Admin Frontend**: `https://zetik-admin.vercel.app` (free)
- **MinIO Storage**: `https://minio-api.playbitz.com/zetik` (already working!)

---

## 🚀 Ready to Deploy?

Follow the steps above! The key advantage is:

**You already have most production configs ready!**

- MinIO ✅
- Admin secret ✅
- Social auth ✅
- Payment integration ✅

Just need to:

1. Generate JWT secrets
2. Deploy to Railway
3. Update CORS origins
4. Deploy frontend to Vercel (free!)

Let me know if you need help with any specific step!
