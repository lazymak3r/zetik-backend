#!/bin/bash

echo "Starting all services..."

# Kill any existing processes on our ports
echo "Cleaning up existing processes..."
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Start main backend
echo "Starting main backend on port 4000..."
npm run start:dev &
MAIN_PID=$!

# Wait a bit for main backend to start
sleep 3

# Start admin backend
echo "Starting admin backend on port 3001..."
cd admin-panel/backend && npm run start:dev &
ADMIN_PID=$!
cd ../..

# Wait a bit for admin backend to start
sleep 3

# Start admin frontend
echo "Starting admin frontend on port 3002..."
cd admin-panel/frontend && npm start &
FRONTEND_PID=$!
cd ../..

echo ""
echo "All services started:"
echo "- Main Backend: http://localhost:4000"
echo "- Admin Backend: http://localhost:3001"
echo "- Admin Frontend: http://localhost:3002"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for Ctrl+C
trap "echo 'Stopping all services...'; kill $MAIN_PID $ADMIN_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait