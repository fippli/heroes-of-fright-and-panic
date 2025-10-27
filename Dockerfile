# Production Dockerfile for Forest Game
# Multi-stage build for optimal image size

# Stage 1: Build
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files and configs
COPY tsconfig.json tsconfig.build.json vite.config.js ./
COPY src/ ./src/

# Copy static assets
COPY static/img/ ./static/img/

# Build the project (TypeScript compilation + Vite build)
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Create app directory
WORKDIR /app

# Copy package files for production dependencies only
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/static ./static

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "dist/api/index.js"]

