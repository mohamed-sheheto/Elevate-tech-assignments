# Outbox Pattern — NestJS

NestJS + TypeORM + Redis demo for a `Product` resource that uses two reliability patterns sharing a single Redis hash `product:{id} -> {value, version, dirty}`.

## Features

* **Product CRUD** — `POST /product`, `GET /product/:id` (cache-first), `PATCH /product/:id` via `src/product/`
* **Transactional Outbox** — avoids persistence gap by committing `Product` + `Outbox` rows atomically and relaying to Redis asynchronously (`src/outbox/`)
* **Versioned Write-Behind Cache with Lua** — avoids concurrency issues with atomic version checks and dirty-flag flush (`src/versioned-cache/`)

## How It Works (Shallow)

**Transactional Outbox:** `createUsingOutbox` saves the product and an `Outbox` entry (`PENDING`) in one transaction. A cron job (`EVERY_30_SECONDS`) picks `PENDING` entries, writes them to Redis (`dirty=0`, `EXPIRE 60s`), and marks them `PROCESSED`. Retries up to 5 times else `FAILED`, skipping stale versions if Redis already has a newer `version`.

**Versioned Cache:** Updates use a Lua script `SET_IF_NEWER` that only writes to Redis if `new_version > current_version`, setting `dirty=1`. Reads are cache-first. A flush job (`EVERY_5_SECONDS`) finds `dirty=1` keys, upserts to Postgres with a `version` guard, and clears the flag via Lua `CLEAR_DIRTY_IF_UNCHANGED` only if the version hasn't changed concurrently.

Redis key is unified — `dirty=0` means already persisted (outbox path), `dirty=1` means needs flush (write-behind path).

## Tech Stack

NestJS 11, TypeORM, PostgreSQL, Redis (`ioredis` + `@keyv/redis`), `@nestjs/schedule`.

## Prerequisites

* Node.js 20+, `pnpm` only
* PostgreSQL `localhost:5432` (`postgres`/`112233`/`postgres`) and Redis `localhost:6379` — override with `REDIS_URL` / `PORT` (`src/app.module.ts`)

No migrations needed — `synchronize: true` + `autoLoadEntities: true`.

## Setup & Run

```bash
pnpm install
pnpm run start:dev      # watch mode
pnpm run start:debug    # watch + debug
pnpm run build          # nest build
pnpm run start:prod     # node dist/main
```

App on `http://localhost:3000` with global `ValidationPipe { whitelist, forbidNonWhitelisted }`.

## API

| Method | Route | Description |
|---|---|---|
| `POST` | `/product` | Create via outbox — `{"name","price","stock"}` |
| `GET` | `/product/:id` | Cache-first read |
| `PATCH` | `/product/:id` | Versioned write-behind update |

```bash
curl -X POST http://localhost:3000/product -H "Content-Type: application/json" -d '{"name":"Widget","price":99.99,"stock":100}'
curl http://localhost:3000/product/<id>
curl -X PATCH http://localhost:3000/product/<id> -H "Content-Type: application/json" -d '{"price":79.99}'
```

## Verify

```bash
pnpm run lint              # eslint --fix
pnpm run format            # prettier
pnpm exec tsc --noEmit     # typecheck (module:nodenext)
pnpm test                  # jest src/**/*.spec.ts
pnpm run build             # must pass before start:prod
```

Tests need live Postgres + Redis.

## Project Structure

```
src/main.ts, src/app.module.ts
src/product/        # controller, service, entity (@VersionColumn), dto
src/outbox/         # entity (status/retry/version), service (cron 30s)
src/versioned-cache/# service (Lua), flush service (cron 5s), lua-scripts.ts
```

## License

MIT
