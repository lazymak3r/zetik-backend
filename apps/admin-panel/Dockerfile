FROM node:24-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for backend
COPY . .

# Install all dependencies (including workspaces)
RUN pnpm install --frozen-lockfile

# Build admin panel application
RUN pnpm build:admin

# Build admin panel frontend (assuming React or similar in frontend/admin-panel)
FROM node:24-alpine AS frontend-builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /frontend

# Copy frontend source code and package files
COPY frontend/admin-panel/package.json ./
COPY frontend/admin-panel/ ./

# Build arguments
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN pnpm install && pnpm build

# Production stage
FROM node:24-alpine AS production

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy source code for backend
COPY . .

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/apps/admin-panel/dist /app/apps/admin-panel/dist

# Copy all built required libraries
COPY --from=builder /app/libs ./libs

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /frontend/build ./frontend/admin-panel/build

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start application
CMD ["node", "apps/admin-panel/dist/main.js"]
