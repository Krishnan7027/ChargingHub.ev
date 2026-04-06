/**
 * Lightweight in-memory TTL cache.
 * Suitable for caching expensive computations (congestion, demand, grid)
 * across requests within a single Node process.
 *
 * Usage:
 *   const cache = createCache({ ttlMs: 60_000, maxEntries: 500 });
 *   cache.set('key', value);
 *   const hit = cache.get('key'); // null if expired/missing
 */

class TTLCache {
  constructor({ ttlMs = 60_000, maxEntries = 1000 } = {}) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.store = new Map(); // key → { value, expiresAt }
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    // Evict oldest entries if at capacity
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.ttlMs),
    });
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.store.delete(key);
  }

  /** Delete all keys matching a prefix. */
  invalidatePrefix(prefix) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear() {
    this.store.clear();
  }

  get size() {
    return this.store.size;
  }

  /** Remove all expired entries. */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get-or-compute: returns cached value or calls fn() to compute,
   * cache, and return it. Great for wrapping service calls.
   *
   *   const data = await cache.wrap('station:123:congestion', () => computeCongestion(123));
   */
  async wrap(key, fn, ttlMs) {
    const cached = this.get(key);
    if (cached !== null) return cached;
    const value = await fn();
    this.set(key, value, ttlMs);
    return value;
  }
}

function createCache(opts) {
  return new TTLCache(opts);
}

// Shared caches for different subsystems
const caches = {
  congestion: createCache({ ttlMs: 5 * 60_000, maxEntries: 200 }),    // 5 min
  demand:     createCache({ ttlMs: 10 * 60_000, maxEntries: 200 }),   // 10 min
  grid:       createCache({ ttlMs: 30_000, maxEntries: 100 }),         // 30s
  prediction: createCache({ ttlMs: 15_000, maxEntries: 200 }),         // 15s — must be shorter than frontend poll (30s)
  general:    createCache({ ttlMs: 60_000, maxEntries: 500 }),         // 1 min
};

module.exports = { createCache, TTLCache, caches };
