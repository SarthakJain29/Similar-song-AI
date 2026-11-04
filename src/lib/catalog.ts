/**
 * Catalog: turns raw Last.fm / Deezer responses into rich `Track` objects.
 *  - `getTrack`   : Last.fm side (canonical names, tags, listeners) - cheap, used for ranking.
 *  - `hydrate`    : Deezer side (artwork, preview availability, release year) - fetched lazily.
 */
import { DAY, HOUR, memoize } from "./cache";
import { cleanArtist, cleanTitle, fold, trackId } from "./music/normalize";
import { cleanTags } from "./music/tags";
import { sources } from "./sources";
import type { SearchHit, Track, TrackRef } from "./types";

export async function search(query: string, limit = 8): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const hits = await sources.deezer.search(q, limit * 2);
    if (hits.length) return hits.slice(0, limit);
  } catch {
    /* fall through to Last.fm */
  }
  return (await sources.lastfm.searchTracks(q, limit)).slice(0, limit);
}

/** Last.fm-backed track (no artwork yet). Returns null when Last.fm doesn't know the song. */
export const getTrack = memoize(
  async (ref: TrackRef): Promise<Track | null> => {
    const lf = sources.lastfm;
    let info = await lf.trackInfo(ref);
    if (!info) {
      const cleaned = { artist: cleanArtist(ref.artist), title: cleanTitle(ref.title) };
      if (cleaned.artist !== ref.artist || cleaned.title !== ref.title) info = await lf.trackInfo(cleaned);
    }
    if (!info) return null;
    let tags = info.tags;
    if (tags.length < 2) {
      try {
        tags = cleanTags([...tags, ...(await lf.artistTopTags(info.artist))]);
      } catch {
        /* artist tags are a nice-to-have */
      }
    }
    // Last.fm users often tag tracks with the artist's name; that's not a musical descriptor.
    const artistKey = fold(info.artist);
    tags = tags.filter((t) => fold(t) !== artistKey);
    return {
      id: trackId(info),
      artist: info.artist,
      title: info.title,
      album: info.album,
      listeners: info.listeners,
      tags,
      lastfmUrl: info.url,
    };
  },
  { keyFn: (r) => `t:${trackId(r)}`, ttlMs: (r) => (r ? DAY : HOUR), max: 5000 },
);

export interface Hydration {
  id: string;
  artwork?: string;
  album?: string;
  deezerId?: number;
  hasPreview?: boolean;
  year?: number;
}

/** Deezer side: artwork + release year. Never throws; missing data just stays undefined. */
export const hydrate = memoize(
  async (ref: TrackRef): Promise<Hydration> => {
    const id = trackId(ref);
    try {
      const m = await sources.deezer.match(ref);
      if (!m) return { id };
      let year: number | undefined;
      let artwork = m.artwork;
      if (m.id) {
        const d = await sources.deezer.details(m.id).catch(() => null);
        year = d?.year;
        artwork = artwork ?? d?.artwork;
      }
      return { id, artwork, album: m.album, deezerId: m.id || undefined, hasPreview: m.hasPreview, year };
    } catch {
      return { id };
    }
  },
  // empty results are retried sooner so a transient Deezer failure doesn't stick
  { keyFn: (r) => `h:${trackId(r)}`, ttlMs: (h) => (h.artwork ? 7 * DAY : 10 * 60_000), max: 5000 },
);

export async function fullTrack(ref: TrackRef): Promise<Track | null> {
  const base = await getTrack(ref);
  if (!base) return null;
  return applyHydration(base, await hydrate(base));
}

export function applyHydration(t: Track, h: Hydration): Track {
  return {
    ...t,
    artwork: h.artwork ?? t.artwork,
    album: t.album ?? h.album,
    deezerId: h.deezerId ?? t.deezerId,
    hasPreview: h.hasPreview ?? t.hasPreview,
    year: h.year ?? t.year,
  };
}
