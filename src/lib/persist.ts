/**
 * Optional persistent cache tier (Upstash Redis / Vercel KV, both free-tier) behind the in-memory cache.
 * Enabled only when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or the Vercel KV names
 * KV_REST_API_URL + KV_REST_API_TOKEN) are set. Uses the REST API via fetch, so no dependency.
 * It must never break a request: every failure degrades to "cache miss", and repeated failures
 * switch the tier off for a minute (circuit breaker).
 */
export interface PersistentStore {
  get(key: string): Promise<{ v: unknown } | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
}

const PREFIX = "ssai:v1:";
const TIMEOUT_MS = 1500;
let failures = 0;
let offUntil = 0;

function creds() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function command(c: { url: string; token: string }, args: Array<string | number>): Promise<unknown> {
  const res = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result;
}

function guarded<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (Date.now() < offUntil) return Promise.resolve(fallback);
  return fn().then(
    (r) => {
      failures = 0;
      return r;
    },
    () => {
      if (++failures >= 3) {
        offUntil = Date.now() + 60_000;
        failures = 0;
      }
      return fallback;
    },
  );
}

export function persistentStore(): PersistentStore | null {
  const c = creds();
  if (!c) return null;
  return {
    get: (key) =>
      guarded(async () => {
        const raw = await command(c, ["GET", PREFIX + key]);
        if (typeof raw !== "string") return undefined;
        try {
          return JSON.parse(raw) as { v: unknown };
        } catch {
          return undefined;
        }
      }, undefined),
    set: (key, value, ttlMs) =>
      guarded(async () => {
        await command(c, ["SET", PREFIX + key, JSON.stringify({ v: value }), "PX", Math.max(1000, Math.round(ttlMs))]);
      }, undefined),
  };
}

export const persistentCacheEnabled = () => creds() !== null;

/** Test hook. */
export function resetPersistState() {
  failures = 0;
  offUntil = 0;
}
