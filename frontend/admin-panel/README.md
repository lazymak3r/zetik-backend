# Zetik Admin Panel Frontend

This directory contains the React admin dashboard for the Zetik Casino platform.

## Structure

```
frontend/
└── admin-panel/    # React admin dashboard
```

## Key Features

- **React Dashboard**: Modern admin interface for casino management
- **API Integration**: Connects to the main backend API
- **Responsive Design**: Works on desktop and mobile devices

## Setup

### Prerequisites

- Node.js 24+
- Main backend running on port 4000
- PostgreSQL running (via docker-compose in main backend)

### Installation

From the main zetik-backend directory:

```bash
# Install admin frontend dependencies
cd frontend/admin-panel && npm install
```

### Running the Application

```bash
# Development mode from main directory
cd frontend/admin-panel && npm start  # Admin frontend on port 3000

# Or from admin-panel directory
npm start
```

### Building for Production

```bash
# Build admin frontend
cd frontend/admin-panel && npm run build
```

## Configuration

### Environment Variables (.env)

```bash
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_ADMIN_API_URL=http://localhost:4000/admin
```

## Architecture

### API Integration

The admin frontend connects to the main backend API endpoints:

- Authentication via `/auth/admin/login`
- Admin operations via `/admin/*` endpoints
- Regular API calls for data fetching

### Authentication

- JWT-based authentication
- Admin session management
- Secure API communication

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## API Endpoints Used

- `POST /auth/admin/login` - Admin login
- `GET /admin/dashboard/stats` - Dashboard statistics
- `GET /admin/users` - List users
- `GET /admin/transactions` - List transactions
- `GET /admin/games` - Game management
- `GET /admin/settings` - System settings

## Development Notes

1. **API Changes**: When backend API changes, update the frontend accordingly
2. **Styling**: Uses modern CSS/SCSS for styling
3. **State Management**: React hooks and context for state management

## Troubleshooting

### API Connection Issues

If you get API connection errors:

1. Ensure main backend is running on port 4000
2. Check API URL in environment variables
3. Verify CORS settings in backend

### Build Issues

For build problems:

1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear npm cache: `npm cache clean --force`
3. Check for TypeScript errors

### Port Conflicts

Default ports:

- Main backend: 4000
- Admin frontend: 3000
