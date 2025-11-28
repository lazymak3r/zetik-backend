FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for fireblocks-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build fireblocks-service application
RUN pnpm build -F @zetik/fireblocks-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for fireblocks-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/fireblocks-service/dist /app/apps/fireblocks-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 4002

# Start application (no migrations needed for fireblocks-service)
CMD ["sh", "-c", "cd apps/fireblocks-service && node dist/fireblocks-service/src/main.js"]
