import { TokenBucket } from "./algo.js";
import { NextFunction, Response, Request } from 'express'

const BUCKET_CONFIG = {
  capacity: 2,
  refillRate: 10,
  refillInterval: 20000
} as const;

const CLEANUP_MAX_AGE_MS = 300000;
const CLEANUP_INTERVAL_MS = 300000;

const rateLimiter = new TokenBucket(BUCKET_CONFIG)

const cleanupInterval = setInterval(() => { rateLimiter.cleanUp(CLEANUP_MAX_AGE_MS) }, CLEANUP_INTERVAL_MS)
cleanupInterval.unref();

function getClientKey(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientKey = getClientKey(req);
  const allowed = rateLimiter.consume(clientKey);

  const state = rateLimiter.getState(clientKey);

  res.setHeader('X-RateLimit-Limit', BUCKET_CONFIG.capacity.toString());
  res.setHeader('X-RateLimit-Remaining', state.remaining.toString());
  res.setHeader('X-RateLimit-Reset', state.resetMs.toString());

  if (!allowed) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please slow down.',
      retryAfter: `${Math.ceil(state.resetMs / 1000)} seconds`
    });
    return;
  }

  next();
}