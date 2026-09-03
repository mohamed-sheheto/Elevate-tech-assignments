# AGENTS.md

## Package Manager
- `pnpm` only (`pnpm-lock.yaml` present). Use `pnpm install`, `pnpm run <script>` — not `npm`/`yarn`.

## Run / Build
- `pnpm run start:dev` — watch mode; `pnpm run start:debug` — watch + `--debug`
- `pnpm run build` (`nest build`, `deleteOutDir:true` in `nest-cli.json:6`, `sourceRoot:src`) then `pnpm run start:prod` (`node dist/main`)
- `src/main.ts:8` global `ValidationPipe{whitelist:true, forbidNonWhitelisted:true}`; port `process.env.PORT ?? 3000`
- Requires **Postgres** `localhost:5432 postgres/112233/postgres` and **Redis** `localhost:6379` — hardcoded defaults in `src/app.module.ts:13-33` (override with `REDIS_URL`/`PORT`). `synchronize:true` + `autoLoadEntities:true` so no migrations; `CacheModule` global via `@keyv/redis`.

## Verify
- `pnpm run lint` — `eslint "{src,apps,libs,test}/**/*.ts" --fix` (`eslint.config.mjs:7` `recommendedTypeChecked` + `projectService:true`, ignores `eslint.config.mjs`, `prettier/prettier: [error, {endOfLine:auto}]`, `no-explicit-any:off`)
- `pnpm run format` — `prettier --write "src/**/*.ts" "test/**/*.ts"` (`singleQuote:true, trailingComma:all` in `.prettierrc:2`)
- `pnpm exec tsc --noEmit` — typecheck (no `typecheck` script; `tsconfig.json:3` is `module:nodenext` + `moduleResolution:nodenext` + `resolvePackageJsonExports:true`)
- `pnpm test` — Jest `rootDir:src`, `testRegex:.*\.spec\.ts$` (`package.json:66`); single: `pnpm test -- <path>.spec.ts`; `pnpm run test:watch`, `pnpm run test:cov` (`coverageDirectory:../coverage`), `pnpm run test:debug` (`--runInBand`)
- `pnpm run test:e2e` — `jest --config ./test/jest-e2e.json` (`rootDir:.`, `testRegex:.e2e-spec.ts$`); `test/app.e2e-spec.ts:7` is stale `GET / -> Hello World` and needs live DB+Redis (no testcontainers).
- `pnpm run build` must pass before `start:prod`; no CI workflows (`.github/` absent).

## Architecture
- Entrypoints: `src/main.ts` -> `src/app.module.ts` -> `ProductModule` / `OutboxModule` / `VersionedCacheModule` (`@nestjs/schedule` enabled).
- **Product resource (consumer of both assignments):** `src/product/entities/product.entity.ts:17` `@VersionColumn`; `src/product/product.controller.ts:7` `POST /product` -> `createUsingOutbox`, `GET /product/:id` -> `findOne` (cache-first), `PATCH /product/:id` -> `updateUsingVersionedCache`; `src/product/product.service.ts:17` transaction writes `Product` + delegates `OutboxService.createEntry`, `findOne` cache-first via `VersionedCacheService.read`, `updateUsingVersionedCache` bumps `version` and calls `writeBehind`; `src/product/product.module.ts:8` imports `OutboxModule` + `VersionedCacheModule` (only `Product` in `forFeature`).
- **Assignment 1 — Outbox Pattern (avoid persistence gap, `src/outbox/`):** `src/outbox/entity/outbox.entity.ts:11` `status:PENDING|PROCESSED|FAILED` + `@Index(['status','createdAt'])`; `src/outbox/outbox.service.ts:20` `@Cron(EVERY_30_SECONDS)` polls 50 `PENDING` ordered by `createdAt`, `applyToCache` unified on Redis hash `product:{id} {value,version,dirty}` via `InjectRedis` `hgetall/hset` (skips if `cached.version >= entry.version`, writes `dirty:0` + `expire 60s`), exposes `createEntry(manager, data)` for transactional use; retries `retryCount<5` else `FAILED`; `src/outbox/outbox.module.ts` exports `OutboxService`.
- **Assignment 2 — Versioned Cache with Lua (avoid concurrency, `src/versioned-cache/`):** `src/versioned-cache/scripts/lua-scripts.ts:1` `SET_IF_NEWER`/`CLEAR_DIRTY_IF_UNCHANGED` Lua + `declare module 'ioredis'` augmentation; `src/versioned-cache/versioned-cache.service.ts:11` `VersionedCacheService` `defineCommand` on `onModuleInit`, hash `product:{id} {value,version,dirty}` via `hgetall/hset` + `setIfNewer`/`clearDirtyIfUnchanged`; `src/versioned-cache/flush.service.ts:18` `VersionedCacheFlushService` `@Cron(EVERY_5_SECONDS)` flushes dirty keys (`keys product:*` + pipeline `hget dirty`) with `WHERE version < :version` guard and `upsert` fallback, clears dirty via Lua.
- Single Redis key `product:{id}` shared by both assignments (`dirty:0` for outbox warm-up, `dirty:1` for write-behind) — no dual encoding. Path alias `src/...` (e.g. `src/product/product.module.ts:6`) relies on `tsconfig.json:16` `baseUrl:./` — no `paths` mapping. Concise, no shared interfaces — each assignment is self-contained module.

## Gotchas
- Windows repo (`E:\\...`); ESLint `prettier endOfLine:auto` avoids CRLF failures.
- Unit/e2e tests require live Postgres+Redis — they will fail without services; don't add migrations (synchronize handles schema).
- Don't commit `dist/`, `coverage/`, `.env*` (see `.gitignore:1,19,42`).
