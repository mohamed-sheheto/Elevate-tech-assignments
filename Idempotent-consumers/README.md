# Idempotent Consumer

Ensures each RabbitMQ job is processed exactly once despite at-least-once delivery. Duplicate deliveries are deduplicated via Redis and messages are only acked after successful processing.

## Problem

RabbitMQ delivers at-least-once. Duplicates happen on producer retries, `nack(requeue)`, consumer crash before `ack`, or competing consumers. Without deduplication, jobs run twice.

## Solution

- **Idempotency key:** `job.id` (`randomUUID()` at publish).
- **Dedup store:** Redis with atomic `SET NX EX 24h`.
- **Reliable ack:** `ack` only after work + Redis commit; `nack(requeue:true)` on failures; `ack` on duplicates to avoid poison loops.

## Flow

```
POST /crop → RabbitMQ (durable, persistent) → Consumer → Redis → process → ack
```

1. **Produce** `src/server.ts:30` — `POST /crop` validates `image, cropWidth, cropHeight`, creates `job`, publishes to `image-processing-queue`, returns `202 { jobId }`.
2. **Claim** `src/dedupRedis.ts:6` — `SET jobId "processing" EX 86400 NX`:
   - `OK` → `claimed` → process
   - `completed` → `duplicate` → `ack` skip
   - `processing` → `retry` → reprocess
3. **Consume** `src/consumer.ts:27` — `prefetch(1)`, `claim()` → `cropImage()` → `complete()` (`SET jobId "completed"`) → `ack`. On Redis down or processing error → `nack` requeue.

## Code

| File | Purpose |
|---|---|
| `src/server.ts` | Express producer, durable queue |
| `src/dedupRedis.ts` | `claim()` / `complete()` with `SET NX` + TTL |
| `src/consumer.ts` | Worker with dedup check and ack/nack |
| `docker-compose.yml` | RabbitMQ (5672, 15672) + Redis (6379) |

## Ack Guarantees

- Success → `complete()` then `ack`
- Duplicate → `ack` without processing
- Failure / Redis down → `nack(msg, false, true)` for redelivery
- Invariant: `process → Redis completed → ack`

## Quick Start

```bash
pnpm docker:up
pnpm install
pnpm start:server   # :3000
pnpm start:consumer # worker

curl -X POST http://localhost:3000/crop \
  -H "Content-Type: application/json" \
  -d '{"image":"photo.jpg","cropWidth":"800","cropHeight":"600"}'
```

## API

`POST /crop` — body: `image, cropWidth, cropHeight` → `202 { jobId, status: "queued" }` / `400` on missing fields.
