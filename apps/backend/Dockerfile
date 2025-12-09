FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for backend
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build shared libraries first
RUN pnpm --filter @zetik/common build
RUN pnpm --filter @zetik/shared-entities build

# Build backend application only (no frontend)
RUN pnpm --filter @zetik/backend build

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for backend
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/backend/dist /app/apps/backend/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check for cluster mode
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

# Run migrations and start application
# Use cluster.js for cluster mode, fallback to main.js if NODE_CLUSTER_ENABLED=false
CMD ["sh", "-c", "cd apps/backend && pnpm typeorm -d src/data-source-migration.ts migration:run && if [ \"$NODE_CLUSTER_ENABLED\" = \"true\" ]; then node dist/cluster.js; else node dist/main.js; fi"]
