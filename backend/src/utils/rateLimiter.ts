/**
 * Simple in-memory token bucket rate limiter.
 * Per-key (e.g. per username), not global.
 */
type Bucket = { tokens: number; lastRefill: number };
const buckets = new Map<string, Bucket>();

export function takeToken(key: string, opts: { capacity: number; refillPerSec: number }): boolean {
    const now = Date.now();
    const b = buckets.get(key) || { tokens: opts.capacity, lastRefill: now };
    const elapsed = (now - b.lastRefill) / 1000;
    b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSec);
    b.lastRefill = now;
    if (b.tokens < 1) {
        buckets.set(key, b);
        return false;
    }
    b.tokens -= 1;
    buckets.set(key, b);
    return true;
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [k, b] of buckets.entries()) {
        if (b.lastRefill < cutoff) buckets.delete(k);
    }
}, 5 * 60 * 1000);
