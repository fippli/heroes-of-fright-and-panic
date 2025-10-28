# Dev image that runs Vite (client) + tsx watch (server)
FROM node:22-alpine

WORKDIR /app
RUN corepack enable

RUN pnpm -v


# keep tools available
RUN apk add --no-cache bash

# copy only what's needed to install deps
COPY package.json pnpm-lock.yaml ./


# install all deps (dev+prod) for dev environment
RUN pnpm fetch
RUN pnpm install --frozen-lockfile

# Bring config files so TypeScript/Vite work without bind mount (compose will still mount the whole project)
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Expose client + server ports
EXPOSE 5173 3000

# Recommended env for watching in containers
ENV CHOKIDAR_USEPOLLING=1 \
    WATCHPACK_POLLING=true \
    VITE_PORT=5173 \
    HOST=0.0.0.0

# Default command runs both client and server in watch mode
CMD ["pnpm", "dev:container"]
