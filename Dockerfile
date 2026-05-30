# Multi-stage build for codeLog server
# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/types packages/types
COPY packages/server packages/server
COPY packages/web packages/web
COPY packages/cli packages/cli
COPY tsconfig.json ./

# Build
RUN pnpm --filter @codelog/types build
RUN pnpm --filter @codelog/web build
RUN pnpm --filter @codelog/server build
RUN pnpm --filter @codelog/cli build

# Stage 2: production image
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests (prod deps only)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json packages/types/
COPY packages/server/package.json packages/server/
COPY packages/cli/package.json packages/cli/

RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/server/dist packages/server/dist
COPY --from=builder /app/packages/web/dist packages/web/dist
COPY --from=builder /app/packages/cli/dist packages/cli/dist

# Create data directory for persistence
RUN mkdir -p /data

EXPOSE 38291

ENV NODE_ENV=production
ENV CODELOG_DB_PATH=/data/codelog.db

CMD ["node", "packages/cli/dist/index.js", "--persist", "--db-path", "/data/codelog.db"]
