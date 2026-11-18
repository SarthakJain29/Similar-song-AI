import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoize } from "./cache";
import { persistentStore, resetPersistState } from "./persist";

describe("persistent cache tier", () => {
  beforeEach(() => {
    resetPersistState();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is off by default (memory only)", () => {
    expect(persistentStore()).toBeNull();
  });

  it("reads through and writes behind Redis when configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const db = new Map<string, string>();
    const calls: unknown[][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const args = JSON.parse(init.body as string) as string[];
        calls.push(args);
        if (args[0] === "SET") db.set(args[1], args[2]);
        return new Response(JSON.stringify({ result: args[0] === "GET" ? (db.get(args[1]) ?? null) : "OK" }));
      }),
    );
    const fn = vi.fn(async (x: number) => ({ doubled: x * 2 }));
    const a = memoize(fn, { keyFn: (x) => `k${x}`, ttlMs: 60_000, persist: true });
    expect(await a(2)).toEqual({ doubled: 4 });
    await new Promise((r) => setTimeout(r, 10));
    expect(calls.some((c) => c[0] === "SET" && String(c[1]).startsWith("ssai:v1:k2") && c[3] === "PX")).toBe(true);
    // a fresh memoizer (new instance / cold start) is served from Redis without calling fn again
    const b = memoize(fn, { keyFn: (x) => `k${x}`, ttlMs: 60_000, persist: true });
    expect(await b(2)).toEqual({ doubled: 4 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("degrades to a normal cache miss when Redis fails, and trips the breaker", async () => {
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "tok";
    const f = vi.fn(async () => {
      throw new Error("down");
    });
    vi.stubGlobal("fetch", f);
    const fn = vi.fn(async (x: number) => x + 1);
    const m = memoize(fn, { keyFn: (x) => `z${x}`, ttlMs: 1000, persist: true });
    for (let i = 0; i < 6; i++) expect(await m(i)).toBe(i + 1);
    // 3 failed GET + 3 failed SET attempts at most before the breaker opens; far fewer than 12
    expect(f.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("does not persist when the option is off", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await memoize(async () => 1, { keyFn: () => "q", ttlMs: 1000 })();
    expect(f).not.toHaveBeenCalled();
  });
});
