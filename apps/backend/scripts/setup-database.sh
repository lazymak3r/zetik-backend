#!/bin/bash

# Database setup script for Zetik Casino Backend

set -e  # Exit on error

echo "🚀 Zetik Casino Backend - Database Setup"
echo "========================================"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if docker compose is available
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
elif docker-compose version &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Change to backend directory
cd "$(dirname "$0")/.."

# Load environment variables
if [ -f .env ]; then
    set -a  # automatically export all variables
    source .env
    set +a  # disable automatic export
else
    echo "❌ .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created .env file. Please review and update the configuration."
    else
        echo "⚠️  No .env.example found. Using default values."
    fi
fi

# Function to wait for PostgreSQL
wait_for_postgres() {
    echo "⏳ Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if $DOCKER_COMPOSE exec -T postgres pg_isready -U ${DB_USERNAME:-postgres} -d ${DB_DATABASE:-postgres} &> /dev/null; then
            echo "✅ PostgreSQL is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        ((attempt++))
    done
    
    echo "❌ PostgreSQL failed to start within 60 seconds"
    return 1
}

# Function to run SQL command
run_sql() {
    local sql="$1"
    $DOCKER_COMPOSE exec -T postgres psql -U ${DB_USERNAME:-postgres} -d ${DB_DATABASE:-postgres} -c "$sql"
}

# Start PostgreSQL
echo ""
echo "🐘 Starting PostgreSQL container..."
$DOCKER_COMPOSE up -d postgres

# Wait for PostgreSQL to be ready
if ! wait_for_postgres; then
    echo "❌ Failed to start PostgreSQL"
    exit 1
fi

# Create schemas
echo ""
echo "📚 Creating database schemas..."
run_sql "CREATE SCHEMA IF NOT EXISTS users;"
run_sql "CREATE SCHEMA IF NOT EXISTS payments;"
run_sql "CREATE SCHEMA IF NOT EXISTS balance;"
run_sql "CREATE SCHEMA IF NOT EXISTS admin;"
run_sql "CREATE SCHEMA IF NOT EXISTS bonus;"
run_sql "CREATE SCHEMA IF NOT EXISTS games;"
run_sql "CREATE SCHEMA IF NOT EXISTS blog;"
run_sql "CREATE SCHEMA IF NOT EXISTS chat;"
run_sql "CREATE SCHEMA IF NOT EXISTS affiliate;"
echo "✅ Schemas created successfully!"

# Test database connection with TypeORM
echo ""
echo "🔌 Testing database connection..."
npm run typeorm query "SELECT 1" &> /dev/null && echo "✅ Database connection successful!" || echo "⚠️  Could not test connection via TypeORM"

# Display connection information
echo ""
echo "📋 Database Connection Information:"
echo "=================================="
echo "Host: ${DB_HOST:-localhost}"
echo "Port: ${DB_PORT:-5432}"
echo "Database: ${DB_DATABASE:-postgres}"
echo "Username: ${DB_USERNAME:-postgres}"
echo "Password: ${DB_PASSWORD:-postgres}"
echo ""
echo "Connection URL: postgresql://${DB_USERNAME:-postgres}:${DB_PASSWORD:-postgres}@${DB_HOST:-localhost}:${DB_PORT:-5432}/${DB_DATABASE:-postgres}"
echo ""

# Check if migrations are available
echo "🔍 Checking for database migrations..."
if [ -d "src/migrations" ] && [ "$(ls -A src/migrations/*.ts 2>/dev/null)" ]; then
    echo "📦 Migrations found. Run 'npm run migration:run' to apply them."
else
    echo "ℹ️  No migrations found. The application will use synchronize mode."
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Run migrations (if any): npm run migration:run"
echo "2. Seed the database: npm run seed"
echo "3. Start the application: npm run start:dev"
echo ""
echo "To stop the database: $DOCKER_COMPOSE down"
echo "To remove all data: $DOCKER_COMPOSE down -v"
