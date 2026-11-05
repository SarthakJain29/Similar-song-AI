/** Small helpers shared by the route handlers. */
import { NextResponse } from "next/server";
import { TTLCache } from "./cache";

export const cacheHeaders = (sMaxAge: number) => ({ "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 4}` });

export function json(data: unknown, init: { status?: number; maxAge?: number } = {}) {
  return NextResponse.json(data, {
    status: init.status ?? 200,
    headers: init.maxAge ? cacheHeaders(init.maxAge) : { "Cache-Control": "no-store" },
  });
}

export const fail = (message: string, status = 400) => json({ error: message }, { status });

export function str(v: unknown, max = 200): string | null {
  return typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null;
}

export function ref(v: unknown): { artist: string; title: string } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const artist = str(o.artist);
  const title = str(o.title);
  return artist && title ? { artist, title } : null;
}

/** Naive per-IP sliding-window limiter for expensive routes (LLM, journey). */
const hits = new TTLCache<number[]>(5000);
export function rateLimit(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) return false;
  recent.push(now);
  hits.set(key, recent, windowMs);
  return true;
}
