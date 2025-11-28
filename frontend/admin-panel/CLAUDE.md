# CLAUDE.md - Admin Panel

This file provides guidance to Claude Code when working with the admin panel within the zetik-backend repository.

## Overview

The admin panel is a separate application suite within the zetik-backend monorepo that provides administrative functionality for the Zetik Casino platform. It consists of:

- **Backend**: NestJS API that shares entity types with the main casino backend
- **Frontend**: React dashboard with Material-UI

## Key Architecture Decision

The admin panel is designed to:

1. **Share database entities** with the main backend (no duplication)
2. **Run independently** on different ports
3. **Import types only** from the main backend via TypeScript path mappings
4. **Maintain separate authentication** from the main casino app

## Type Sharing

All entity imports go through a central module:

```typescript
// admin-panel/backend/src/shared/zetik-types.module.ts
```

This file imports entities from the main backend using the `@zetik/*` path mapping:

```typescript
export { UserEntity } from '@zetik/users/users.entity';
export { AdminEntity } from '@zetik/admin/admin.entity';
// ... etc
```

## Directory Structure

```
admin-panel/
├── backend/
│   ├── src/
│   │   ├── app.module.ts           # Root module
│   │   ├── main.ts                 # Entry point (port 3001)
│   │   ├── auth/                   # Admin authentication
│   │   ├── dashboard/              # Dashboard statistics
│   │   ├── users/                  # User management
│   │   ├── transactions/           # Transaction management
│   │   ├── games/                  # Game management
│   │   ├── settings/               # System settings
│   │   ├── websocket/              # Real-time updates
│   │   └── shared/
│   │       └── zetik-types.module.ts  # Shared type imports
│   ├── package.json
│   └── tsconfig.json               # Configured with @zetik/* paths
└── frontend/
    ├── src/
    │   ├── components/             # Reusable UI components
    │   ├── pages/                  # Route pages
    │   ├── store/                  # Redux store
    │   └── config/
    │       └── api.ts              # API configuration
    └── package.json
```

## Development Commands

All commands should be run from the main zetik-backend directory:

```bash
# Install dependencies
npm run admin:install           # Backend dependencies
npm run admin:frontend:install  # Frontend dependencies

# Development
npm run admin:start:dev         # Start backend (port 3001)
npm run admin:frontend:start    # Start frontend (port 3000)

# Build
npm run admin:build             # Build backend
npm run admin:frontend:build    # Build frontend

# Run with main backend
npm run start:all:dev           # Everything together
```

## Configuration

### Backend Configuration

- Default port: 3001
- API prefix: `/api`
- Swagger docs: `http://localhost:3001/api`

### Frontend Configuration

- Default port: 3000
- API URL: `http://localhost:3001/api`
- Environment variable: `REACT_APP_API_URL`

## Working with Shared Types

### DO:

- Import all entities through `shared/zetik-types.module.ts`
- Use the exact entity types from main backend
- Adapt your code to work with the main backend's schema

### DON'T:

- Create duplicate entity definitions
- Import implementation code from main backend
- Modify the database schema (do this in main backend)

### Example:

```typescript
// Good - Import from shared module
import { UserEntity, AdminEntity } from '../shared/zetik-types.module';

// Bad - Direct import from main backend
import { UserEntity } from '@zetik/users/users.entity';

// Bad - Creating duplicate entity
@Entity('users')
class UserEntity { ... }
```

## Database Considerations

The admin panel connects to the same PostgreSQL database as the main backend:

- Uses the same connection configuration
- Shares all schemas and tables
- Must respect the existing entity structures

### Working with Different Entity Structures

The main backend's entities may differ from typical admin panel expectations:

1. **UserEntity**:
   - Email is stored in `registrationData` JSON field
   - Uses `isBanned` instead of `isActive`
   - Supports multiple auth strategies

2. **AdminEntity**:
   - Enhanced with roles and permissions
   - Uses `passwordHash` field
   - Has `needsPasswordSetup` flag

Always check the actual entity structure in the main backend before writing queries.

## API Endpoints

### Authentication

- `POST /api/auth/login` - Admin login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Dashboard

- `GET /api/dashboard/stats` - Overall statistics
- `GET /api/dashboard/revenue` - Revenue data
- `GET /api/dashboard/users` - User statistics

### User Management

- `GET /api/users` - List users with filters
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id` - Update user
- `POST /api/users/:id/ban` - Ban/unban user

### Transaction Management

- `GET /api/transactions` - List transactions
- `GET /api/transactions/:id` - Transaction details
- `POST /api/transactions/:id/approve` - Approve withdrawal
- `POST /api/transactions/:id/reject` - Reject withdrawal

## Common Tasks

### Adding a New Endpoint

1. Create the controller method in appropriate module
2. Import entities from `shared/zetik-types.module.ts`
3. Use TypeORM repository with the shared entities
4. Add appropriate guards and decorators

### Updating Frontend

1. Update API calls in the appropriate service
2. Update Redux slices if needed
3. Ensure TypeScript types match backend DTOs

### Handling Entity Differences

When the main backend entity doesn't match admin panel needs:

```typescript
// Example: Getting user email from registrationData
const email = user.registrationStrategy === 'EMAIL' ? user.registrationData?.email : null;
```

## Troubleshooting

### Import Errors

- Ensure main backend is installed: `npm install` in root
- Check tsconfig.json has correct path mappings
- Verify the import is through shared module

### Build Errors

- Main backend must be installed first
- Check that admin panel is excluded from main build
- Verify all imports use `@zetik/*` paths

### Type Mismatches

- Always check the actual entity definition in main backend
- Use optional chaining for JSON fields
- Create helper functions for complex type conversions

## Best Practices

1. **Keep it Simple**: Admin panel should focus on management tasks
2. **Read-Only First**: Prefer read operations, be careful with writes
3. **Type Safety**: Always use TypeScript types from shared entities
4. **Error Handling**: Implement comprehensive error handling
5. **Logging**: Add appropriate logging for admin actions
6. **Security**: Validate all admin permissions
