# syntax=docker/dockerfile:1
# Build from the DealOS repository root. This image runs only the NestJS API.
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV CI=true

# Prisma's generated client and Node's TLS connections need OpenSSL.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace manifests first to cache dependency installation.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json

# Install the API, contracts and Prisma workspaces, NOT the Next.js dependencies.
RUN npm ci --include=dev --no-audit --no-fund \
    --workspace=@dealos/api \
    --workspace=@dealos/contracts \
    --workspace=@dealos/db \
    --include-workspace-root=false

COPY apps/api/ apps/api/
COPY packages/contracts/ packages/contracts/
COPY packages/db/ packages/db/

RUN npm run build -w @dealos/contracts
# Prisma 7's config requires DATABASE_URL during generation. Use a NON-SECRET
# placeholder: generating the client never connects to this database.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate
RUN npm run build -w @dealos/api

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    API_PORT=8080 \
    NODE_OPTIONS=--max-old-space-size=128

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json

# Install production dependencies for the API and shared contracts only.
RUN npm ci --omit=dev --no-audit --no-fund \
    --workspace=@dealos/api \
    --workspace=@dealos/contracts \
    --include-workspace-root=false \
    && npm cache clean --force

COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
# This project uses prisma-client-js, which generates into node_modules/.prisma.
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma

USER node
EXPOSE 8080

# Migrations must run separately against Neon; never migrate or seed on startup.
CMD ["node", "apps/api/dist/main.js"]
