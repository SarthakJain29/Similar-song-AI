/**
 * Tiny server-side caching + throttling toolkit.
 *  - TTLCache: bounded LRU with per-entry expiry.
 *  - memoize(): caches async results AND de-duplicates concurrent identical calls.
 *  - Limiter: spaces out outbound calls so we stay inside upstream rate limits.
 * State is per server instance, which is enough for a free-tier deployment;
 * HTTP Cache-Control headers on our API routes add CDN caching on top.
 */

export class TTLCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(private max = 2000) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // refresh LRU position
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.v;
  }

  set(key: string, v: V, ttlMs: number) {
    if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { v, exp: Date.now() + ttlMs });
  }

  get size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

/** Wrap an async function with caching + in-flight de-duplication. */
export function memoize<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: {
    keyFn: (...args: A) => string;
    ttlMs: number | ((result: R) => number);
    max?: number;
  },
): (...args: A) => Promise<R> {
  const cache = new TTLCache<R>(opts.max ?? 2000);
  const inflight = new Map<string, Promise<R>>();
  return (...args: A) => {
    const key = opts.keyFn(...args);
    const hit = cache.get(key);
    if (hit !== undefined) return Promise.resolve(hit);
    const running = inflight.get(key);
    if (running) return running;
    const p = fn(...args)
      .then((r) => {
        const ttl = typeof opts.ttlMs === "function" ? opts.ttlMs(r) : opts.ttlMs;
        if (ttl > 0) cache.set(key, r, ttl);
        return r;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

/**
 * Serialises call *starts* so that at most `perSecond` begin per second
 * (evenly spaced), while allowing up to `concurrency` to run at once.
 */
export class Limiter {
  private nextSlot = 0;
  private active = 0;
  private waiters: Array<() => void> = [];
  private readonly gap: number;
  constructor(
    perSecond: number,
    private concurrency = 6,
  ) {
    this.gap = 1000 / perSecond;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((res) => this.waiters.push(res));
    }
    this.active++;
    try {
      const now = Date.now();
      const start = Math.max(now, this.nextSlot);
      this.nextSlot = start + this.gap;
      if (start > now) await new Promise((r) => setTimeout(r, start - now));
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}

/** Run async mappers with bounded parallelism, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
