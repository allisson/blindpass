.PHONY: dev build test test\:crypto test\:server\:unit test\:server\:integration test\:e2e screenshots lint format format\:check ci db\:migrate db\:studio prod\:build prod\:up prod\:down prod\:logs

dev:
	docker compose up -d && pnpm turbo run dev

build:
	pnpm turbo run build

test:
	pnpm turbo run test

test\:crypto:
	pnpm --filter @blindpass/crypto run test

test\:server\:unit:
	pnpm --filter @blindpass/server run test

test\:server\:integration:
	pnpm --filter @blindpass/server run test:integration

# Requires: make dev already running (docker + backend). Playwright starts its own frontend.
test\:e2e:
	pnpm --filter @blindpass/web run test:e2e

# Requires: make dev already running. Outputs PNGs to docs/screenshots/.
screenshots:
	pnpm --filter @blindpass/web run screenshots

lint:
	pnpm turbo run lint

format:
	pnpm prettier --write .

format\:check:
	pnpm prettier --check .

ci:
	pnpm turbo run lint
	pnpm tsc -b
	pnpm prettier --check .
	pnpm turbo run test
	pnpm --filter @blindpass/server run test:ci

db\:migrate:
	cd apps/server && pnpm exec drizzle-kit migrate

db\:studio:
	cd apps/server && pnpm exec drizzle-kit studio

prod\:build:
	docker build -f apps/server/Dockerfile -t allisson/blindpass-server .
	docker build -f apps/web/Dockerfile -t allisson/blindpass-webapp .

prod\:up:
	docker compose -f docker-compose.prod.yml up -d --wait

prod\:down:
	docker compose -f docker-compose.prod.yml down

prod\:logs:
	docker compose -f docker-compose.prod.yml logs -f
