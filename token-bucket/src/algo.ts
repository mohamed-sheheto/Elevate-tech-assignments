interface TokenBucketConfig {
  capacity: number;
  refillRate: number;
  refillInterval: number
}

type tokenBucketConfig = TokenBucketConfig;

interface BucketState {
  tokens: number;
  lastRefill: number
}

type bucketState = BucketState;

class TokenBucket {
  private buckets: Map<string, BucketState> = new Map();
  private config: TokenBucketConfig;

  constructor(config: TokenBucketConfig) {
    this.config = config;
  }

  private refill(bucket: BucketState): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    if (timePassed <= 0) return;

    const tokensToAdd = Math.floor((timePassed / this.config.refillInterval) * this.config.refillRate)

    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.config.capacity, bucket.tokens + tokensToAdd)


      bucket.lastRefill += Math.floor((tokensToAdd * this.config.refillInterval) / this.config.refillRate);


      if (bucket.tokens === this.config.capacity) {
        bucket.lastRefill = now;
      }
    }
  }

  consume(key: string, tokensRequired = 1): boolean {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefill: Date.now() }
      this.buckets.set(key, bucket)
    }

    this.refill(bucket);

    if (bucket.tokens >= tokensRequired) {
      bucket.tokens -= tokensRequired

      return true
    }
    return false
  }

  getState(key: string): { remaining: number; resetMs: number } {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      return {
        remaining: this.config.capacity,
        resetMs: 0
      };
    }

    this.refill(bucket);

    const tokensNeeded = this.config.capacity - bucket.tokens;
    if (tokensNeeded <= 0) {
      return {
        remaining: Math.floor(bucket.tokens),
        resetMs: 0
      };
    }
    const resetMs = Math.ceil((tokensNeeded / this.config.refillRate) * this.config.refillInterval)

    return {
      remaining: Math.floor(bucket.tokens),
      resetMs
    }
  }

  cleanUp(maxAgeMs: number = 3600000): void {
    const now = Date.now();

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAgeMs) this.buckets.delete(key)
    }
  }

}

export { TokenBucket, TokenBucketConfig, tokenBucketConfig, BucketState, bucketState }
