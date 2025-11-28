FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for currency-rate-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build currency-rate-service application
RUN pnpm build -F @zetik/currency-rate-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for currency-rate-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/currency-rate-service/dist /app/apps/currency-rate-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# No port exposed (cron service only)

# Start application (no migrations needed for currency-rate-service)
CMD ["sh", "-c", "cd apps/currency-rate-service && node dist/currency-rate-service/src/main.js"]
