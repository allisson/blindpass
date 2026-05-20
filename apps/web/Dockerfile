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

RUN pnpm install --frozen-lockfile

COPY apps/web/ apps/web/
COPY packages/ packages/

# Build workspace deps first (skips packages without a build script), then web
RUN pnpm --filter "@blindpass/web^..." run --if-present build
RUN pnpm --filter @blindpass/web build

# ---- Runtime ----
FROM nginx:alpine AS runtime
RUN apk add --no-cache gettext
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/conf.d/default.conf.template
COPY apps/web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
