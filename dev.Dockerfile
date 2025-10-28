FROM node:22-alpine
WORKDIR /app
RUN corepack enable && apk add --no-cache bash

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

COPY tsconfig*.json ./
COPY vite.config.ts ./

# mount your repo at /app with compose
EXPOSE 3000

ENV CHOKIDAR_USEPOLLING=1 WATCHPACK_POLLING=true

CMD ["pnpm", "dev"]