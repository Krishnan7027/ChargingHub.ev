'use strict';

/**
 * Cache utility unit tests.
 *
 * The TTLCache is pure in-memory logic with no I/O so no mocks are needed.
 * Tests use Jest's fake timer API (jest.useFakeTimers) to advance time without
 * actually waiting, keeping the suite fast and deterministic.
 */

const { TTLCache, createCache, caches } = require('../src/utils/cache');

// ── TTLCache – basic get/set ──────────────────────────────────────────────────

describe('TTLCache – get and set', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new TTLCache({ ttlMs: 1000, maxEntries: 10 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null for a key that was never set', () => {
    expect(cache.get('missing')).toBeNull();
  });

  it('returns the stored value immediately after set()', () => {
    cache.set('foo', { data: 42 });
    expect(cache.get('foo')).toEqual({ data: 42 });
  });

  it('stores any serialisable value type (string)', () => {
    cache.set('k', 'hello');
    expect(cache.get('k')).toBe('hello');
  });

  it('stores any serialisable value type (number)', () => {
    cache.set('n', 99);
    expect(cache.get('n')).toBe(99);
  });

  it('stores any serialisable value type (array)', () => {
    cache.set('arr', [1, 2, 3]);
    expect(cache.get('arr')).toEqual([1, 2, 3]);
  });

  it('stores falsy values correctly (0, false, empty string)', () => {
    cache.set('zero', 0);
    cache.set('false', false);
    cache.set('empty', '');

    // get() returns null for missing – not for falsy values stored explicitly
    expect(cache.get('zero')).toBe(0);
    expect(cache.get('false')).toBe(false);
    expect(cache.get('empty')).toBe('');
  });

  it('overwrites an existing key on a second set()', () => {
    cache.set('k', 'first');
    cache.set('k', 'second');
    expect(cache.get('k')).toBe('second');
  });
});

// ── TTLCache – TTL expiry ─────────────────────────────────────────────────────

describe('TTLCache – TTL expiry', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new TTLCache({ ttlMs: 1000, maxEntries: 10 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null after the default TTL elapses', () => {
    cache.set('key', 'value');
    jest.advanceTimersByTime(1001); // just past TTL
    expect(cache.get('key')).toBeNull();
  });

  it('returns value when queried just before TTL expires', () => {
    cache.set('key', 'value');
    jest.advanceTimersByTime(999); // 1ms before expiry
    expect(cache.get('key')).toBe('value');
  });

  it('honours a per-entry TTL override passed to set()', () => {
    cache.set('fast', 'gone', 500); // overrides default 1000ms TTL
    jest.advanceTimersByTime(501);
    expect(cache.get('fast')).toBeNull();
  });

  it('per-entry TTL does not affect other entries using default TTL', () => {
    cache.set('fast', 'gone', 200);
    cache.set('slow', 'here', 2000);
    jest.advanceTimersByTime(300);
    expect(cache.get('fast')).toBeNull();
    expect(cache.get('slow')).toBe('here');
  });

  it('removes the key from the store on expired get() (lazy eviction)', () => {
    cache.set('k', 'v');
    jest.advanceTimersByTime(1001);
    cache.get('k'); // triggers lazy delete
    expect(cache.size).toBe(0);
  });
});

// ── TTLCache – has() and delete() ────────────────────────────────────────────

describe('TTLCache – has() and delete()', () => {
  let cache;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new TTLCache({ ttlMs: 1000, maxEntries: 10 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('has() returns true for a live key', () => {
    cache.set('k', 'v');
    expect(cache.has('k')).toBe(true);
  });

  it('has() returns false for a missing key', () => {
    expect(cache.has('nope')).toBe(false);
  });

  it('has() returns false for an expired key', () => {
    cache.set('k', 'v');
    jest.advanceTimersByTime(1001);
    expect(cache.has('k')).toBe(false);
  });

  it('delete() removes a key so get() returns null', () => {
    cache.set('k', 'v');
    cache.delete('k');
    expect(cache.get('k')).toBeNull();
  });

  it('delete() on a missing key does not throw', () => {
    expect(() => cache.delete('ghost')).not.toThrow();
  });

  it('size decrements after delete()', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.size).toBe(1);
  });
});

// ── TTLCache – maxEntries eviction ───────────────────────────────────────────

describe('TTLCache – maxEntries eviction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('evicts the oldest entry when maxEntries is reached', () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 3 });

    cache.set('first', 1);
    cache.set('second', 2);
    cache.set('third', 3);
    // Adding a 4th entry must evict the oldest (first)
    cache.set('fourth', 4);

    expect(cache.get('first')).toBeNull(); // evicted
    expect(cache.get('second')).toBe(2);
    expect(cache.get('third')).toBe(3);
    expect(cache.get('fourth')).toBe(4);
  });

  it('maintains exactly maxEntries after many inserts', () => {
    const max = 5;
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: max });

    for (let i = 0; i < 20; i++) {
      cache.set(`key-${i}`, i);
    }

    // The underlying Map size should not exceed maxEntries
    expect(cache.store.size).toBeLessThanOrEqual(max);
  });
});

// ── TTLCache – clear() ────────────────────────────────────────────────────────

describe('TTLCache – clear()', () => {
  it('removes all entries', () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeNull();
  });
});

// ── TTLCache – invalidatePrefix() ────────────────────────────────────────────

describe('TTLCache – invalidatePrefix()', () => {
  let cache;

  beforeEach(() => {
    cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
  });

  it('removes all keys that start with the given prefix', () => {
    cache.set('station:123:congestion', 'high');
    cache.set('station:123:demand', 'medium');
    cache.set('station:456:congestion', 'low');
    cache.set('user:789', 'alice');

    cache.invalidatePrefix('station:123:');

    expect(cache.get('station:123:congestion')).toBeNull();
    expect(cache.get('station:123:demand')).toBeNull();
  });

  it('leaves keys that do not match the prefix', () => {
    cache.set('station:123:congestion', 'data');
    cache.set('station:456:congestion', 'other');
    cache.set('user:789', 'alice');

    cache.invalidatePrefix('station:123:');

    expect(cache.get('station:456:congestion')).toBe('other');
    expect(cache.get('user:789')).toBe('alice');
  });

  it('does nothing when no keys match the prefix', () => {
    cache.set('foo', 'bar');
    expect(() => cache.invalidatePrefix('nonexistent:')).not.toThrow();
    expect(cache.get('foo')).toBe('bar');
    expect(cache.size).toBe(1);
  });

  it('invalidates all keys when prefix is an empty string', () => {
    cache.set('alpha', 1);
    cache.set('beta', 2);
    cache.invalidatePrefix('');
    expect(cache.size).toBe(0);
  });
});

// ── TTLCache – prune() ────────────────────────────────────────────────────────

describe('TTLCache – prune()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('removes all expired entries on demand', () => {
    const cache = new TTLCache({ ttlMs: 500, maxEntries: 100 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('long', 3, 10_000);

    jest.advanceTimersByTime(600); // a and b expired, long has not
    cache.prune();

    expect(cache.size).toBe(1); // only 'long' remains
    expect(cache.get('long')).toBe(3);
  });

  it('does not remove live entries', () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    cache.set('live', 'yes');
    cache.prune();
    expect(cache.get('live')).toBe('yes');
  });
});

// ── TTLCache – wrap() ─────────────────────────────────────────────────────────

describe('TTLCache – wrap()', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('calls fn() on first access and caches the result', async () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    const fn = jest.fn().mockResolvedValue({ computed: true });

    const result = await cache.wrap('key', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ computed: true });
  });

  it('returns the cached value without calling fn() on subsequent accesses', async () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    const fn = jest.fn().mockResolvedValue('expensive-value');

    await cache.wrap('key', fn);
    const second = await cache.wrap('key', fn);

    expect(fn).toHaveBeenCalledTimes(1); // only called once
    expect(second).toBe('expensive-value');
  });

  it('calls fn() again after TTL expires', async () => {
    const cache = new TTLCache({ ttlMs: 1000, maxEntries: 100 });
    const fn = jest.fn().mockResolvedValue('fresh');

    await cache.wrap('key', fn);
    jest.advanceTimersByTime(1001);
    await cache.wrap('key', fn);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates errors thrown by fn()', async () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    const fn = jest.fn().mockRejectedValue(new Error('compute failed'));

    await expect(cache.wrap('key', fn)).rejects.toThrow('compute failed');
    // Nothing should be cached on error
    expect(cache.get('key')).toBeNull();
  });

  it('accepts a per-call TTL override', async () => {
    const cache = new TTLCache({ ttlMs: 60_000, maxEntries: 100 });
    const fn = jest.fn().mockResolvedValue('short-lived');

    await cache.wrap('key', fn, 200); // 200ms TTL
    jest.advanceTimersByTime(201);

    expect(cache.get('key')).toBeNull(); // expired
  });
});

// ── createCache factory ───────────────────────────────────────────────────────

describe('createCache()', () => {
  it('returns a TTLCache instance', () => {
    const c = createCache({ ttlMs: 5000, maxEntries: 50 });
    expect(c).toBeInstanceOf(TTLCache);
  });

  it('uses default TTL and maxEntries when options are omitted', () => {
    const c = createCache();
    expect(c.ttlMs).toBe(60_000);
    expect(c.maxEntries).toBe(1000);
  });
});

// ── Shared caches singleton ───────────────────────────────────────────────────

describe('caches singleton', () => {
  it('exports a congestion cache', () => {
    expect(caches.congestion).toBeInstanceOf(TTLCache);
  });

  it('exports a demand cache', () => {
    expect(caches.demand).toBeInstanceOf(TTLCache);
  });

  it('exports a grid cache', () => {
    expect(caches.grid).toBeInstanceOf(TTLCache);
  });

  it('exports a prediction cache', () => {
    expect(caches.prediction).toBeInstanceOf(TTLCache);
  });

  it('exports a general cache', () => {
    expect(caches.general).toBeInstanceOf(TTLCache);
  });

  it('congestion cache has a 5-minute TTL', () => {
    expect(caches.congestion.ttlMs).toBe(5 * 60_000);
  });

  it('grid cache has a 30-second TTL', () => {
    expect(caches.grid.ttlMs).toBe(30_000);
  });
});
