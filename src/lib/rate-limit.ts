// In-process token bucket per P7-07. Sufficient at MVP scale where every
// request hits the same Vercel function instance most of the time. If we
// scale to many concurrent instances, swap the Map for Vercel KV / Upstash
// Redis — the interface stays the same.

type Bucket = { tokens: number; lastRefillMs: number };

const buckets = new Map<string, Bucket>();

export type RateLimit = {
  capacity: number;
  refillPerSec: number;
};

// Common rate-limit presets keyed to the relevant decision/task.
export const LIMITS = {
  listingCreate: { capacity: 10, refillPerSec: 10 / 86400 }, // 10/day
  claimFile: { capacity: 5, refillPerSec: 5 / 86400 }, // 5/day
  accountCreate: { capacity: 3, refillPerSec: 3 / 3600 }, // 3/hour per IP
} as const satisfies Record<string, RateLimit>;

/**
 * Take one token. Returns true if allowed, false if rate-limited.
 * Mutates internal state. Buckets that idle for an hour are evicted to keep
 * the in-process map bounded.
 */
export function take(key: string, limit: RateLimit): boolean {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: limit.capacity, lastRefillMs: now };
  const elapsedSec = (now - b.lastRefillMs) / 1000;
  b.tokens = Math.min(limit.capacity, b.tokens + elapsedSec * limit.refillPerSec);
  b.lastRefillMs = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(key, b);
  evictStale();
  return true;
}

let lastEvictMs = 0;
function evictStale() {
  const now = Date.now();
  if (now - lastEvictMs < 60_000) return;
  lastEvictMs = now;
  const cutoff = now - 60 * 60 * 1000;
  for (const [k, v] of buckets.entries()) {
    if (v.lastRefillMs < cutoff) buckets.delete(k);
  }
}
