# ---------- Base image ----------
  FROM node:22-alpine AS base
  WORKDIR /app
  # Enable pnpm via Corepack
  RUN corepack enable
  
  # Optional: needed for HEALTHCHECK (curl)
  RUN apk add --no-cache curl
  
  # ---------- Dependencies (install once, cacheable) ----------
  FROM base AS deps
  # Copy only files needed to resolve deps
  COPY package.json pnpm-lock.yaml ./
  # Pre-fetch all deps into the store, then install offline (fast, cached)
  RUN pnpm fetch
  RUN pnpm install --frozen-lockfile --offline
  
  # ---------- Build (client + server) ----------
  FROM deps AS build
  # App sources and configs
  COPY tsconfig*.json ./
  COPY vite.config.ts ./
  COPY src ./src
  COPY static ./static 
  
  # Build separately so each outputs to its own dir:
  # - Vite -> dist/client
  # - tsc   -> dist/server + then add ".js" extensions to emitted imports
  RUN pnpm build:client
  RUN pnpm build:server

  RUN cp -r ./static ./dist/static
  
  # ---------- Production runtime ----------
  FROM base AS runtime
  ENV NODE_ENV=production
  WORKDIR /app
  
  # Install ONLY production deps offline, leveraging the lockfile
  COPY package.json pnpm-lock.yaml ./
  RUN pnpm fetch --prod && pnpm install --prod --frozen-lockfile --offline
  
  # Bring in build artifacts
  COPY --from=build /app/dist ./dist
  
  # Expose your server port
  EXPOSE 3000
  
  # Optional healthcheck hitting /api/health (adjust if needed)
  HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
    CMD curl -fsS http://localhost:3000/api/health || exit 1
  
  # Start the server
  CMD ["node", "dist/server/index.js"]
  