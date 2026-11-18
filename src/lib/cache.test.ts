import { describe, expect, it, vi } from "vitest";
import { Limiter, TTLCache, mapLimit, memoize } from "./cache";

describe("TTLCache", () => {
  it("expires entries and evicts least-recently-used", () => {
    vi.useFakeTimers();
    const c = new TTLCache<number>(2);
    c.set("a", 1, 1000);
    c.set("b", 2, 1000);
    c.get("a");
    c.set("c", 3, 1000); // evicts b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    vi.advanceTimersByTime(1500);
    expect(c.get("a")).toBeUndefined();
    vi.useRealTimers();
  });
});

describe("memoize", () => {
  it("caches results and de-duplicates concurrent calls", async () => {
    const fn = vi.fn(async (x: number) => x * 2);
    const m = memoize(fn, { keyFn: (x) => String(x), ttlMs: 1000 });
    const [a, b] = await Promise.all([m(2), m(2)]);
    expect([a, b]).toEqual([4, 4]);
    await m(2);
    expect(fn).toHaveBeenCalledTimes(1);
    await m(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("does not cache failures", async () => {
    let n = 0;
    const m = memoize(
      async () => {
        if (n++ === 0) throw new Error("boom");
        return "ok";
      },
      { keyFn: () => "k", ttlMs: 1000 },
    );
    await expect(m()).rejects.toThrow("boom");
    await expect(m()).resolves.toBe("ok");
  });
});

describe("Limiter / mapLimit", () => {
  it("spaces out call starts", async () => {
    const l = new Limiter(20, 5); // 50ms gap
    const starts: number[] = [];
    const t0 = Date.now();
    await Promise.all(Array.from({ length: 4 }, () => l.run(async () => void starts.push(Date.now() - t0))));
    expect(starts[3]).toBeGreaterThanOrEqual(120);
  });
  it("mapLimit preserves order and bounds concurrency", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (x) => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return x * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
