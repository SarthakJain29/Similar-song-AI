import { DAY, HOUR, Limiter, MIN, memoize } from "../cache";
import { fetchJson } from "../http";
import { cleanArtist, cleanTitle, fold, trackId } from "../music/normalize";
import type { SearchHit, TrackRef } from "../types";
import type { DeezerDetails, DeezerMatch, DeezerSource } from "./contract";

const BASE = "https://api.deezer.com";
// Deezer allows ~50 requests / 5 s per IP.
const limiter = new Limiter(8, 6);

interface RawTrack {
  id: number;
  title: string;
  title_short?: string;
  preview?: string;
  release_date?: string;
  artist: { name: string };
  album?: { title?: string; cover_medium?: string; cover_big?: string; cover_xl?: string; release_date?: string };
}

const get = <T>(path: string) => limiter.run(() => fetchJson<T>(`${BASE}${path}`, { timeoutMs: 7000 }));

const art = (a?: RawTrack["album"]) => a?.cover_big || a?.cover_medium || a?.cover_xl || undefined;

function toHit(t: RawTrack): SearchHit {
  return {
    id: trackId({ artist: t.artist.name, title: t.title }),
    artist: t.artist.name,
    title: t.title,
    album: t.album?.title,
    artwork: art(t.album),
    deezerId: t.id,
  };
}

const search = memoize(
  async (query: string, limit: number): Promise<SearchHit[]> => {
    const d = await get<{ data?: RawTrack[] }>(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    const seen = new Set<string>();
    const out: SearchHit[] = [];
    for (const t of d.data ?? []) {
      const hit = toHit(t);
      // collapse remasters / re-releases of the same song in autocomplete
      if (seen.has(hit.id)) continue;
      seen.add(hit.id);
      out.push(hit);
    }
    return out;
  },
  { keyFn: (q, l) => `s:${q.toLowerCase()}:${l}`, ttlMs: HOUR },
);

/** Find the Deezer track that best corresponds to an (artist,title) pair. */
const match = memoize(
  async (ref: TrackRef): Promise<DeezerMatch | null> => {
    const artist = cleanArtist(ref.artist);
    const title = cleanTitle(ref.title);
    const queries = [`artist:"${artist.replace(/"/g, "")}" track:"${title.replace(/"/g, "")}"`, `${artist} ${title}`];
    for (const q of queries) {
      const d = await get<{ data?: RawTrack[] }>(`/search?q=${encodeURIComponent(q)}&limit=5`);
      const wantA = fold(artist);
      const wantT = fold(title);
      const hit = (d.data ?? []).find((t) => {
        const a = fold(t.artist.name);
        const tt = fold(cleanTitle(t.title));
        return (a === wantA || a.includes(wantA) || wantA.includes(a)) && (tt === wantT || tt.startsWith(wantT) || wantT.startsWith(tt));
      });
      if (hit) {
        return {
          id: hit.id,
          artist: hit.artist.name,
          title: hit.title,
          album: hit.album?.title,
          artwork: art(hit.album),
          hasPreview: Boolean(hit.preview),
        };
      }
    }
    return null;
  },
  { keyFn: (r) => `m:${trackId(r)}`, ttlMs: (r) => (r ? 7 * DAY : 6 * HOUR), max: 5000 },
);

/** Details incl. release year. Preview URLs are signed and expire after ~15 min => short TTL. */
const details = memoize(
  async (id: number): Promise<DeezerDetails | null> => {
    const t = await get<RawTrack & { error?: unknown }>(`/track/${id}`);
    if (!t || t.error || !t.id) return null;
    const y = parseInt((t.release_date || t.album?.release_date || "").slice(0, 4), 10);
    return {
      id: t.id,
      year: y >= 1900 && y <= new Date().getFullYear() + 1 ? y : undefined,
      previewUrl: t.preview || undefined,
      artwork: art(t.album),
      album: t.album?.title,
    };
  },
  { keyFn: (id) => `d:${id}`, ttlMs: 6 * MIN },
);

export const deezer: DeezerSource = { search, match, details };
