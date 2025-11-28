# Game Configuration System - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the dynamic game configuration system to production. The system replaces hardcoded game settings with database-driven configurations that can be managed through the admin panel.

## Pre-Deployment Checklist

### 1. Environment Preparation

#### Development Environment

- [ ] Database migrations tested and validated
- [ ] All game configurations seeded successfully
- [ ] Integration tests passing
- [ ] Cache layer properly configured
- [ ] Admin panel functionality verified

#### Staging Environment

- [ ] Database migrations applied
- [ ] Performance testing completed
- [ ] Load testing passed
- [ ] Security audit completed
- [ ] Backup procedures tested

#### Production Environment

- [ ] Database backup completed
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured
- [ ] Maintenance window scheduled
- [ ] Team notified of deployment

### 2. Database Preparation

#### Required Environment Variables

```bash
# Core Database Settings
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=postgres
DB_GAMES_SCHEMA=games

# Redis Configuration (for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Game Configuration
NODE_ENV=production  # development | staging | production
ACTIVE_ASSETS=BTC,ETH,USDC,USDT,TRX,SOL

# Optional: Override default house edges
GAME_HOUSE_EDGE_CRASH=2.0
GAME_HOUSE_EDGE_MINES=1.0
GAME_HOUSE_EDGE_PLINKO=2.0
GAME_HOUSE_EDGE_LIMBO=2.0
GAME_HOUSE_EDGE_KENO=5.0
```

#### Database Schemas

Ensure all required schemas exist:

```sql
CREATE SCHEMA IF NOT EXISTS games;
CREATE SCHEMA IF NOT EXISTS admin;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS balance;
CREATE SCHEMA IF NOT EXISTS bonus;
```

### 3. Migration Scripts

#### Step 1: Backup Current Database

```bash
# Create full database backup
pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE > backup_pre_migration_$(date +%Y%m%d_%H%M%S).sql

# Create specific backup of game-related data
pg_dump -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE \
  --schema=games \
  --data-only > backup_games_data_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 2: Apply Database Migrations

```bash
# Navigate to backend directory
cd apps/backend

# Apply structural migrations
npm run typeorm migration:run

# Verify migrations were applied
npm run typeorm migration:show
```

#### Step 3: Migrate Configuration Data

```bash
# Run the migration script
ts-node scripts/migrate-game-configs.ts

# Verify migration results
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
SELECT
  (SELECT COUNT(*) FROM games.game_configs) as configs,
  (SELECT COUNT(*) FROM games.game_bet_limits) as limits,
  (SELECT COUNT(*) FROM games.game_multipliers) as multipliers;
"
```

## Deployment Steps

### Phase 1: Backend Services

#### 1. Deploy Main Backend

```bash
# Build application
npm run build:backend

# Stop current backend service
pm2 stop zetik-backend

# Deploy new version
cp -r apps/backend/dist/* /path/to/production/backend/
cp apps/backend/.env /path/to/production/backend/

# Start backend service
pm2 start zetik-backend
pm2 logs zetik-backend --lines 50
```

#### 2. Deploy Admin Backend

```bash
# Build admin panel backend
npm run build:admin

# Stop current admin service
pm2 stop zetik-admin-backend

# Deploy new version
cp -r apps/admin-panel/dist/* /path/to/production/admin-backend/

# Start admin service
pm2 start zetik-admin-backend
pm2 logs zetik-admin-backend --lines 50
```

### Phase 2: Frontend Deployment

#### 1. Build and Deploy Admin Frontend

```bash
cd frontend/admin-panel

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to web server (nginx/apache)
cp -r build/* /path/to/production/admin-frontend/
```

#### 2. Update Nginx Configuration

```nginx
# /etc/nginx/sites-available/zetik-admin
server {
    listen 443 ssl http2;
    server_name admin.zetik.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # Admin Frontend
    location / {
        root /path/to/production/admin-frontend;
        try_files $uri $uri/ /index.html;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }

    # Admin Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Main Backend API
server {
    listen 443 ssl http2;
    server_name api.zetik.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for real-time games
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Phase 3: Validation and Testing

#### 1. Run Integration Tests

```bash
# Test backend health
curl -f https://api.zetik.com/health || exit 1

# Test admin backend health
curl -f https://admin.zetik.com/api/health || exit 1

# Run comprehensive integration tests
ts-node scripts/test-game-config-integration.ts

# Validate game functionality
ts-node scripts/validate-game-functionality.ts
```

#### 2. Verify Game Configurations

```bash
# Check all game configurations are loaded
curl -s https://api.zetik.com/v1/games/config/crash | jq .
curl -s https://api.zetik.com/v1/games/config/mines | jq .
curl -s https://api.zetik.com/v1/games/config/plinko | jq .

# Check bet limits for each currency
curl -s https://api.zetik.com/v1/games/limits/crash/BTC | jq .
curl -s https://api.zetik.com/v1/games/limits/crash/ETH | jq .

# Verify cache is working
curl -s -w "%{time_total}" https://api.zetik.com/v1/games/config/crash > /dev/null
```

#### 3. Performance Verification

```bash
# Monitor response times
for i in {1..10}; do
  curl -s -w "Response time: %{time_total}s\n" \
    https://api.zetik.com/v1/games/config/crash -o /dev/null
  sleep 1
done

# Check memory usage
ps aux | grep node
free -m

# Monitor database connections
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';
"
```

## Post-Deployment Verification

### 1. Functional Testing

#### Game Services

- [ ] Crash game: Place test bet and verify limits
- [ ] Mines game: Start game and verify mine configurations
- [ ] Plinko game: Test all risk levels
- [ ] Blackjack: Verify side bet configurations
- [ ] Roulette: Test table bet limits
- [ ] Dice: Verify win chance ranges
- [ ] Keno: Test number selection limits

#### Admin Panel

- [ ] Login to admin panel
- [ ] View game configurations
- [ ] Edit a game setting
- [ ] Verify cache invalidation
- [ ] Test bet limit modifications
- [ ] Check audit logging

### 2. Performance Monitoring

#### Metrics to Track

```bash
# Response time monitoring
curl -w "@curl-format.txt" -s https://api.zetik.com/v1/games/config/crash -o /dev/null

# Database performance
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
SELECT
  schemaname,
  tablename,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'games';
"

# Cache hit ratio (Redis)
redis-cli info stats | grep keyspace_hits
redis-cli info stats | grep keyspace_misses
```

#### Alert Thresholds

- API response time > 500ms
- Database connection count > 80% of max
- Cache miss ratio > 20%
- Error rate > 1%

### 3. Security Verification

#### Admin Panel Security

- [ ] HTTPS enforced
- [ ] Authentication required
- [ ] Authorization working correctly
- [ ] Audit logging enabled
- [ ] Rate limiting active

#### API Security

- [ ] Input validation working
- [ ] SQL injection protection active
- [ ] CORS properly configured
- [ ] Rate limiting functional

## Rollback Procedures

### Emergency Rollback

If critical issues are discovered:

#### 1. Immediate Rollback

```bash
# Stop current services
pm2 stop zetik-backend zetik-admin-backend

# Restore previous version
cp -r /backup/previous-version/* /path/to/production/

# Restore database if needed
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE < backup_pre_migration_YYYYMMDD_HHMMSS.sql

# Start services
pm2 start zetik-backend zetik-admin-backend
```

#### 2. Gradual Rollback

```bash
# Disable dynamic configurations (use environment fallback)
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
UPDATE games.game_configs SET status = 'disabled' WHERE created_by = 'system';
"

# Clear cache to force fallback to hardcoded values
redis-cli flushall

# Monitor system behavior
tail -f /var/log/zetik/*.log
```

### Partial Rollback

For specific game issues:

```bash
# Disable specific game dynamic config
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
UPDATE games.game_configs
SET status = 'disabled'
WHERE game_type = 'crash' AND created_by = 'system';
"

# Clear specific cache entries
redis-cli del "game_config:crash"
redis-cli del "bet_limits:crash:*"
```

## Monitoring and Maintenance

### Daily Checks

- [ ] API response times within SLA
- [ ] Database performance metrics normal
- [ ] Cache hit ratio above 80%
- [ ] Error logs reviewed
- [ ] Admin panel accessible

### Weekly Maintenance

- [ ] Review configuration changes in audit log
- [ ] Analyze game performance metrics
- [ ] Check for any configuration drift
- [ ] Update bet limits if needed
- [ ] Review security logs

### Monthly Reviews

- [ ] Performance optimization opportunities
- [ ] Configuration usage patterns
- [ ] Capacity planning assessment
- [ ] Security audit results
- [ ] Backup strategy validation

## Troubleshooting Guide

### Common Issues

#### 1. Configuration Not Loading

```bash
# Check database connection
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "SELECT 1;"

# Verify configurations exist
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
SELECT game_type, status FROM games.game_configs;
"

# Check cache
redis-cli keys "game_config:*"
```

#### 2. Cache Issues

```bash
# Clear all game config cache
redis-cli eval "
for i, name in ipairs(redis.call('KEYS', 'game_config:*')) do
  redis.call('DEL', name)
end
for i, name in ipairs(redis.call('KEYS', 'bet_limits:*')) do
  redis.call('DEL', name)
end
" 0
```

#### 3. Admin Panel Issues

```bash
# Check admin backend logs
pm2 logs zetik-admin-backend

# Verify admin database connection
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "
SELECT COUNT(*) FROM admin.admins;
"

# Test admin API endpoint
curl -v https://admin.zetik.com/api/health
```

#### 4. Game Service Errors

```bash
# Check main backend logs
pm2 logs zetik-backend | grep -i error

# Test specific game configuration
curl -v https://api.zetik.com/v1/games/config/crash

# Verify bet limits
curl -v https://api.zetik.com/v1/games/limits/crash/BTC
```

## Support Contacts

- **DevOps Team**: devops@zetik.com
- **Backend Team**: backend@zetik.com
- **Database Admin**: dba@zetik.com
- **Security Team**: security@zetik.com

## Change Management

### Configuration Changes

1. All changes must go through admin panel
2. Changes are automatically logged with timestamps and user info
3. Critical changes require approval workflow
4. Emergency changes must be documented post-implementation

### Emergency Procedures

1. Contact on-call engineer immediately
2. Document all emergency changes
3. Follow up with post-mortem within 24 hours
4. Update procedures based on lessons learned

---

_This deployment guide should be reviewed and updated after each deployment to incorporate lessons learned and process improvements._
