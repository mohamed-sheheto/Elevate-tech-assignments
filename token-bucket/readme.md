# Token Bucket — Express Rate Limiter

In-memory per-IP rate limiter as Express middleware. No Redis.

## What is this?

Token bucket with `capacity` tokens per IP. Each request costs 1 token; empty bucket → `429`. Tokens refill over time.

* **Bucket** — `Map<ip, {tokens, lastRefill}>` in `src/algo.ts:18`. `refill()` (`src/algo.ts:26`) lazily adds `floor((elapsed/refillInterval)*refillRate)` tokens on each `consume()` (`src/algo.ts:46`).
* **Middleware** — `src/rateLimitMiddleware.ts:22` uses `req.ip`, calls `consume()`, sets `X-RateLimit-*` headers, returns `429` with `retryAfter` if denied.
* **Config** — `src/rateLimitMiddleware.ts:4`: `capacity:2, refillRate:10, refillInterval:20000` (2 burst, 0.5 token/sec). Cleanup every 5m (`src/algo.ts:91`).
* **Wiring** — `src/app.ts:8`: `/health` before middleware (exempt), all else rate-limited. Entry point is `src/app.ts` → `dist/app.js`.

## Run

* Node 20+, no DB. `pnpm install && pnpm run dev` → `http://localhost:3000`
* Entry point: `src/app.ts` (dev via `tsx`) / `dist/app.js` (prod via `node`), `package.json:main` is `dist/app.js`

## API

| Method | Route | Limited |
|---|---|---|
| `GET` | `/health` | No |
| `GET` | `/` | Yes (2 req burst → 429) |

Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Structure

```
src/algo.ts                # TokenBucket class
src/rateLimitMiddleware.ts # middleware + cleanup timer
src/app.ts                 # routes + middleware order + listen + graceful shutdown (entry point)
```
