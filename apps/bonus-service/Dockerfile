FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for bonus-service
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build bonus-service application
RUN pnpm build -F @zetik/bonus-service

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for bonus-service
COPY . .

# Install all dependencies (including dev dependencies for migrations)
RUN pnpm install --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/apps/bonus-service/dist /app/apps/bonus-service/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 4003

# Start application (no migrations needed for bonus-service)
CMD ["sh", "-c", "cd apps/bonus-service && node dist/main.js"]
