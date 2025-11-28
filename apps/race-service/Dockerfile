FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for race-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build race-service application
RUN pnpm build -F @zetik/race-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for race-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/race-service/dist /app/apps/race-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 4005

# Start application (no migrations needed for race-service)
CMD ["sh", "-c", "cd apps/race-service && node dist/race-service/src/main.js"]
