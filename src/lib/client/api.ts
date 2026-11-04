/** Typed client for our own API routes. */
import type { Explanation, JourneyResponse, SearchHit, SimilarResponse, TrackRef, VibeSettings } from "../types";
import type { Hydration } from "../catalog";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body as T;
}

const searchCache = new Map<string, SearchHit[]>();
export async function apiSearch(q: string, signal?: AbortSignal): Promise<SearchHit[]> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const { hits } = await getJson<{ hits: SearchHit[] }>(`/api/search?q=${encodeURIComponent(q)}`, signal);
  searchCache.set(key, hits);
  return hits;
}

export function vibeQuery(v: VibeSettings): string {
  const p = new URLSearchParams();
  if (v.popularity) p.set("popularity", String(v.popularity));
  if (v.era) p.set("era", String(v.era));
  if (v.energy) p.set("energy", String(v.energy));
  if (v.moods.length) p.set("moods", v.moods.join(","));
  return p.toString();
}

export const apiSimilar = (ref: TrackRef, vibe: VibeSettings, signal?: AbortSignal) =>
  getJson<SimilarResponse>(`/api/similar?artist=${encodeURIComponent(ref.artist)}&title=${encodeURIComponent(ref.title)}&${vibeQuery(vibe)}`, signal);

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const apiExplainSimilar = (seed: TrackRef, items: TrackRef[], signal?: AbortSignal) =>
  postJson<{ explanations: Explanation[] }>("/api/explain", { seed, items }, signal).then((r) => r.explanations);

export const apiExplainJourney = (start: TrackRef, end: TrackRef, items: TrackRef[], signal?: AbortSignal) =>
  postJson<{ explanations: Explanation[] }>("/api/explain", { mode: "journey", start, end, items }, signal).then((r) => r.explanations);

export const apiEnrich = (ref: TrackRef) => getJson<Hydration>(`/api/enrich?artist=${encodeURIComponent(ref.artist)}&title=${encodeURIComponent(ref.title)}`);

export async function apiPreviewUrl(t: TrackRef & { deezerId?: number }): Promise<string | null> {
  const qs = t.deezerId ? `id=${t.deezerId}` : `artist=${encodeURIComponent(t.artist)}&title=${encodeURIComponent(t.title)}`;
  const { url } = await getJson<{ url: string | null }>(`/api/preview?${qs}`);
  return url;
}

/** Reads the NDJSON progress stream from /api/journey. */
export async function apiJourney(
  start: TrackRef,
  end: TrackRef,
  steps: number,
  onProgress: (message: string, fraction: number) => void,
  signal?: AbortSignal,
): Promise<JourneyResponse> {
  const res = await fetch("/api/journey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ start, end, steps }), signal });
  if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || `Request failed (${res.status})`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: JourneyResponse | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as { type: string; message?: string; fraction?: number; data?: JourneyResponse };
      if (msg.type === "progress") onProgress(msg.message ?? "", msg.fraction ?? 0);
      else if (msg.type === "error") throw new Error(msg.message || "Journey failed");
      else if (msg.type === "result" && msg.data) result = msg.data;
    }
  }
  if (!result) throw new Error("Journey ended unexpectedly");
  return result;
}
