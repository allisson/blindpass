# ---- Builder ----
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app

# Copy all workspace manifests first — layer cache busts only on dep changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/crypto/package.json packages/crypto/
COPY packages/vault/package.json packages/vault/
COPY packages/api-schema/package.json packages/api-schema/
COPY packages/types/package.json packages/types/

RUN pnpm install --frozen-lockfile

COPY apps/server/ apps/server/
COPY packages/ packages/

# Build workspace deps first (skips packages without a build script), then server
RUN pnpm --filter "@blindpass/server^..." run --if-present build
RUN pnpm --filter @blindpass/server build

# Standalone deploy directory: production deps only, workspace deps bundled
RUN pnpm --filter @blindpass/server deploy --legacy /app/server-deploy

# ---- Runtime ----
FROM node:24-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/server-deploy .
USER app
EXPOSE 3000
CMD ["node", "dist/index.js", "server"]
