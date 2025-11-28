# Admin Panel

Admin panel for Zetik casino platform with bonus management and user administration.

## Environment Configuration

The admin panel requires several environment variables to be set before starting.

### Required Environment Variables

Create a `.env` file in `apps/admin-panel/` directory with the following variables:

```bash
# Admin Panel Configuration
ADMIN_PORT=3001
ADMIN_CORS_ORIGINS=http://localhost:3001,http://localhost:3000

# Backend API Configuration (REQUIRED)
BACKEND_URL=http://localhost:3000
ADMIN_API_SECRET=admin-secret-key

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/zetik_dev

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRES_IN=24h

# Environment
NODE_ENV=development
```

### Configuration Details

- **ADMIN_PORT**: Port for the admin panel server (default: 3001)
- **ADMIN_CORS_ORIGINS**: Comma-separated list of allowed CORS origins
- **BACKEND_URL**: URL of the main backend API server (REQUIRED)
- **ADMIN_API_SECRET**: Secret key for admin panel to access backend admin endpoints (REQUIRED)

## Security Features

### IP Address Filtering

The backend admin endpoints are protected by IP address filtering. Configure allowed IPs in the backend:

```bash
# Backend .env configuration
ADMIN_ALLOWED_IPS=127.0.0.1,::1,localhost,192.168.1.100,10.0.0.50
```

**Default allowed IPs**: `127.0.0.1,::1,localhost` (local development)

**Production setup**: Add your admin panel server IPs to the `ADMIN_ALLOWED_IPS` list.

### Multi-layer Security

Admin endpoints are protected by:

1. **IP Address Filtering** - Only allowed IPs can access admin endpoints
2. **API Secret Validation** - Requires valid `ADMIN_API_SECRET` header
3. **JWT Authentication** - Admin panel requires valid JWT token

### Security Headers

The system checks multiple headers for real client IP:

- `x-forwarded-for` (load balancers, proxies)
- `x-real-ip` (nginx, reverse proxies)
- `cf-connecting-ip` (Cloudflare)
- Connection remote address (fallback)

## Starting the Admin Panel

### Development Mode

```bash
pnpm start:admin:dev
```

### Production Mode

```bash
pnpm build:admin
pnpm start:admin:prod
```

## Features

### Bonus Management

- VIP Tier configuration with Weekly Reload settings
- Weekly Reload bonus calculator and activation
- Bonus transaction management
- Weekly Race prize configuration

### User Management

- User search and filtering
- User details and statistics
- Balance adjustments
- Ban/unban functionality

### Weekly Reload System

- Calculate weekly reload amounts based on user activity
- Support for profitable and losing player percentages
- 7-day bonus schedule creation
- Integration with VIP tier system

## API Endpoints

The admin panel provides REST API endpoints at:

- Base URL: `http://localhost:3001/v1`
- Documentation: `http://localhost:3001/api`
- Frontend: `http://localhost:3001/v1/admin`

### Weekly Reload Endpoints

- `POST /v1/bonuses/weekly-reload/calculate` - Calculate weekly reload for user
- `POST /v1/bonuses/weekly-reload/activate` - Activate weekly reload for user

## Troubleshooting

### Admin Panel Won't Start

If you see errors about missing environment variables:

1. Create `.env` file in `apps/admin-panel/` directory
2. Copy contents from `env.example`
3. Update values according to your setup
4. Restart the admin panel

### Weekly Reload Not Working

1. Ensure backend is running on the configured `BACKEND_URL`
2. Check that `ADMIN_API_SECRET` matches between admin panel and backend
3. Verify user has sufficient VIP level and activity for calculation

## Development

### Building

```bash
pnpm build:admin
```

### Testing

```bash
pnpm test
```

### Linting

```bash
pnpm lint
```
