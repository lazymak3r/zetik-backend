FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for bet-feed-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build bet-feed-service application
RUN pnpm build -F @zetik/bet-feed-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for bet-feed-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/bet-feed-service/dist /app/apps/bet-feed-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 4004

# Start application (no migrations needed for bet-feed-service)
CMD ["sh", "-c", "cd apps/bet-feed-service && node dist/bet-feed-service/src/main.js"]
