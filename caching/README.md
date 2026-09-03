# Outbox Pattern — NestJS

NestJS + TypeORM + Redis demo for `Product` using one Redis hash `product:{id} -> {value, version, dirty}` with two patterns.

## What is this?

* **Transactional Outbox** — fixes cache/DB divergence: `POST /product` saves `Product` + `Outbox(PENDING)` in one transaction (`src/product/product.service.ts:17`), cron every 30s (`src/outbox/outbox.service.ts:28`) pushes to Redis (`dirty=0`, `EXPIRE 60`), retries 5x.
* **Versioned Write-Behind** — fast updates: `PATCH /product/:id` writes to Redis via Lua `SET_IF_NEWER` only if `new_version > current` (`src/versioned-cache/scripts/lua-scripts.ts:1`, `src/versioned-cache/versioned-cache.service.ts:26`, sets `dirty=1`), cron every 5s (`src/versioned-cache/flush.service.ts:18`) flushes `dirty=1` keys to Postgres with `version` guard and clears flag via Lua `CLEAR_DIRTY_IF_UNCHANGED`.
* **Cache-first read** — `GET /product/:id` checks Redis first (`src/product/product.service.ts:35`), falls back to DB.

`dirty=0` = persisted, `dirty=1` = needs flush. `version` (`src/product/entities/product.entity.ts:17`) decides winner.

## Stack

NestJS 11, TypeORM, Postgres, Redis (`ioredis` + `@keyv/redis`), `@nestjs/schedule`.

## Run

* Requires Node 20+, `pnpm`, Postgres `localhost:5432` (`postgres`/`112233`) and Redis `localhost:6379` (override `REDIS_URL` in `src/app.module.ts`). `synchronize:true`, no migrations.
* `pnpm install && pnpm run start:dev` → `http://localhost:3000`

## API

| `POST` | `/product` | `{"name","price","stock"}` |
| `GET` | `/product/:id` | cache-first |
| `PATCH` | `/product/:id` | write-behind |

```bash
curl -X POST http://localhost:3000/product -H "Content-Type: application/json" -d '{"name":"Widget","price":99.99,"stock":100}'
curl http://localhost:3000/product/<id>
curl -X PATCH http://localhost:3000/product/<id> -H "Content-Type: application/json" -d '{"price":79.99}'
```

## Structure

```
src/product/        # controller, service, entity (@VersionColumn)
src/outbox/         # entity, service (cron 30s)
src/versioned-cache/# service (Lua), flush service (cron 5s), lua-scripts.ts
```
