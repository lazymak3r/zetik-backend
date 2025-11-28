FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for crash-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build crash-service application
RUN pnpm build -F @zetik/crash-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for crash-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/crash-service/dist /app/apps/crash-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 4001

# Start application (no migrations needed for crash-service)
CMD ["sh", "-c", "cd apps/crash-service && node dist/crash-service/src/main.js"]
