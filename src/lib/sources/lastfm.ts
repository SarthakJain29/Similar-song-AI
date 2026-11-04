import { DAY, HOUR, Limiter, memoize } from "../cache";
import { config } from "../config";
import { fetchJson } from "../http";
import { cleanTags } from "../music/tags";
import { trackId } from "../music/normalize";
import type { SearchHit, TrackRef } from "../types";
import type { LastfmSource, LfmSimilarTrack, LfmTrackInfo } from "./contract";

const BASE = "https://ws.audioscrobbler.com/2.0/";
// Last.fm documents ~5 req/s averaged over 5 min; short bursts are tolerated and 429s are retried with backoff.
const limiter = new Limiter(10, 12);

interface LfmError {
  error?: number;
  message?: string;
}

async function call<T>(method: string, params: Record<string, string | number>): Promise<(T & LfmError) | null> {
  const qs = new URLSearchParams({
    method,
    api_key: config.lastfmKey,
    format: "json",
    autocorrect: "1",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const data = await limiter.run(() => fetchJson<T & LfmError>(`${BASE}?${qs}`, { timeoutMs: 9000 }));
  // error 6 = "not found"; treat as empty rather than failing the whole request
  if (data?.error === 6) return null;
  if (data?.error) throw new Error(`Last.fm ${method}: ${data.message ?? data.error}`);
  return data;
}

const asArray = <T>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const num = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

interface RawTag {
  name: string;
}

const trackInfo = memoize(
  async (ref: TrackRef): Promise<LfmTrackInfo | null> => {
    const d = await call<{
      track?: {
        name: string;
        url?: string;
        listeners?: string;
        artist: { name: string };
        album?: { title?: string };
        toptags?: { tag?: RawTag | RawTag[] };
      };
    }>("track.getInfo", { artist: ref.artist, track: ref.title });
    const t = d?.track;
    if (!t) return null;
    return {
      artist: t.artist.name,
      title: t.name,
      album: t.album?.title,
      listeners: num(t.listeners),
      tags: cleanTags(asArray(t.toptags?.tag).map((x) => x.name)),
      url: t.url,
    };
  },
  { keyFn: (r) => `ti:${trackId(r)}`, ttlMs: (r) => (r ? 3 * DAY : HOUR), max: 5000 },
);

const similarTracks = memoize(
  async (ref: TrackRef, limit: number): Promise<LfmSimilarTrack[]> => {
    const d = await call<{
      similartracks?: {
        track?: Array<{ name: string; match: number | string; artist: { name: string }; playcount?: string }>;
      };
    }>("track.getSimilar", { artist: ref.artist, track: ref.title, limit });
    return asArray(d?.similartracks?.track).map((t) => ({
      artist: t.artist.name,
      title: t.name,
      match: Math.max(0, Math.min(1, Number(t.match) || 0)),
    }));
  },
  { keyFn: (r, l) => `st:${trackId(r)}:${l}`, ttlMs: DAY },
);

const similarArtists = memoize(
  async (artist: string, limit: number) => {
    const d = await call<{ similarartists?: { artist?: Array<{ name: string; match: string }> } }>("artist.getSimilar", { artist, limit });
    return asArray(d?.similarartists?.artist).map((a) => ({ name: a.name, match: Number(a.match) || 0 }));
  },
  { keyFn: (a, l) => `sa:${a.toLowerCase()}:${l}`, ttlMs: 2 * DAY },
);

const artistTopTracks = memoize(
  async (artist: string, limit: number): Promise<TrackRef[]> => {
    const d = await call<{ toptracks?: { track?: Array<{ name: string; artist: { name: string } }> } }>("artist.getTopTracks", { artist, limit });
    return asArray(d?.toptracks?.track).map((t) => ({ artist: t.artist.name, title: t.name }));
  },
  { keyFn: (a, l) => `att:${a.toLowerCase()}:${l}`, ttlMs: 2 * DAY },
);

const artistTopTags = memoize(
  async (artist: string): Promise<string[]> => {
    const d = await call<{ toptags?: { tag?: RawTag[] } }>("artist.getTopTags", { artist });
    return cleanTags(asArray(d?.toptags?.tag).map((t) => t.name));
  },
  { keyFn: (a) => `atg:${a.toLowerCase()}`, ttlMs: 3 * DAY },
);

const searchTracks = memoize(
  async (query: string, limit: number): Promise<SearchHit[]> => {
    const d = await call<{ results?: { trackmatches?: { track?: Array<{ name: string; artist: string }> } } }>("track.search", { track: query, limit });
    return asArray(d?.results?.trackmatches?.track).map((t) => ({ artist: t.artist, title: t.name, id: trackId({ artist: t.artist, title: t.name }) }));
  },
  { keyFn: (q, l) => `ts:${q.toLowerCase()}:${l}`, ttlMs: HOUR },
);

export const lastfm: LastfmSource = { trackInfo, similarTracks, similarArtists, artistTopTracks, artistTopTags, searchTracks };
