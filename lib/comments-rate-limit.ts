interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const CAPACITY = 5;
const REFILL_PER_WINDOW = 5;

function refill(bucket: Bucket, now: number) {
  const elapsed = now - bucket.lastRefillAt;
  const refillAmount = (elapsed / WINDOW_MS) * REFILL_PER_WINDOW;
  bucket.tokens = Math.min(CAPACITY, bucket.tokens + refillAmount);
  bucket.lastRefillAt = now;
}

export function consumeCommentToken(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? {
    tokens: CAPACITY,
    lastRefillAt: now,
  };

  refill(bucket, now);

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
