import { mapLimit } from "./cache";
import { applyHydration, fullTrack, getTrack, hydrate } from "./catalog";
import { planJourney, type JourneyCandidate } from "./music/journey";
import { cleanArtist, fold, songKey } from "./music/normalize";
import { genrePath, samplePath } from "./music/genres";
import { rankCandidates, type Candidate } from "./music/scoring";
import { sources } from "./sources";
import type { JourneyResponse, JourneyStep, Recommendation, SimilarResponse, Track, TrackRef, VibeSettings } from "./types";
import { config } from "./config";

export class NotFoundError extends Error {}

/** How many Last.fm neighbours get enriched before ranking. Larger when the user wants obscure picks. */
function poolSize(vibe: VibeSettings) {
  return vibe.popularity < -0.3 || vibe.moods.length || vibe.energy !== 0 ? 36 : 24;
}

async function similarCandidates(seed: Track, want: number): Promise<Array<TrackRef & { match: number }>> {
  const lf = sources.lastfm;
  const sims = await lf.similarTracks(seed, 100);
  const out: Array<TrackRef & { match: number }> = sims.map((s) => ({ artist: s.artist, title: s.title, match: s.match }));
  if (out.length < want) {
    // Thin neighbourhood (niche track): borrow popular songs from similar artists.
    try {
      const artists = await lf.similarArtists(seed.artist, 5);
      const tops = await mapLimit(artists, 3, async (a) => ({ a, tracks: await lf.artistTopTracks(a.name, 4) }));
      for (const { a, tracks } of tops) for (const t of tracks) out.push({ ...t, match: a.match * 0.6 });
    } catch {
      /* optional */
    }
  }
  return out;
}

export async function similar(seedRef: TrackRef, vibe: VibeSettings, limit = 12): Promise<SimilarResponse> {
  const t0 = Date.now();
  const seed = await fullTrack(seedRef);
  if (!seed) throw new NotFoundError(`No data found for "${seedRef.title}" by ${seedRef.artist}`);
  const t1 = Date.now();

  const raw = await similarCandidates(seed, 20);
  const t2 = Date.now();
  // Same-artist songs would crowd out the list: keep a few for the "more from this artist" row only.
  const sameArtist = (r: TrackRef) => fold(cleanArtist(r.artist)) === fold(cleanArtist(seed.artist));
  const others = raw.filter((r) => !sameArtist(r));
  const mine = raw.filter(sameArtist).slice(0, 8);
  const pool = [...others.slice(0, poolSize(vibe)), ...mine];
  const needYear = vibe.era !== 0;

  const candidates = (
    await mapLimit(pool, 12, async (p): Promise<Candidate | null> => {
      try {
        let t = await getTrack(p);
        if (!t) return null;
        if (needYear) t = applyHydration(t, await hydrate(t));
        return { track: t, match: p.match };
      } catch {
        return null;
      }
    })
  ).filter((c): c is Candidate => c !== null);

  if (process.env.DEBUG_TIMING) console.log(`[similar] seed ${t1 - t0}ms, neighbours ${t2 - t1}ms, enrich ${Date.now() - t2}ms (${pool.length} tracks)`);
  const results: Recommendation[] = rankCandidates(seed, candidates, vibe, { limit, seedArtistCap: 1 });
  const moreFromArtist = await moreFromSeedArtist(seed, candidates, vibe, new Set(results.map((r) => r.track.id)));
  return { seed, results, moreFromArtist, mock: config.mock };
}

/** Other songs by the seed artist: ranked same-artist candidates, topped up with the artist's top tracks. */
async function moreFromSeedArtist(seed: Track, candidates: Candidate[], vibe: VibeSettings, taken: Set<string>, want = 6): Promise<Recommendation[]> {
  const artistKey = fold(cleanArtist(seed.artist));
  const same = candidates.filter((c) => fold(cleanArtist(c.track.artist)) === artistKey && !taken.has(c.track.id));
  const out = rankCandidates(seed, same, vibe, { limit: want, maxPerArtist: want, seedArtistCap: want });
  if (out.length < want) {
    try {
      const have = new Set([...taken, ...out.map((r) => r.track.id)]);
      const top = await sources.lastfm.artistTopTracks(seed.artist, 12);
      const extra = (await mapLimit(top.slice(0, 10), 8, async (t) => getTrack(t).catch(() => null)))
        .filter((t): t is Track => t !== null)
        .map((t): Candidate => ({ track: t, match: 0.5 }));
      for (const r of rankCandidates(seed, extra, vibe, { limit: want, maxPerArtist: want, seedArtistCap: want })) {
        if (!have.has(r.track.id) && out.length < want) out.push(r);
      }
    } catch {
      /* optional row */
    }
  }
  return out;
}

/* ------------------------------------------------------------------ journey */

export type ProgressFn = (message: string, fraction: number) => void;

export async function journey(startRef: TrackRef, endRef: TrackRef, steps: number, onProgress: ProgressFn = () => {}): Promise<JourneyResponse> {
  onProgress("Reading your two songs…", 0.05);
  const [start, end] = await Promise.all([fullTrack(startRef), fullTrack(endRef)]);
  if (!start) throw new NotFoundError(`No data found for "${startRef.title}" by ${startRef.artist}`);
  if (!end) throw new NotFoundError(`No data found for "${endRef.title}" by ${endRef.artist}`);
  if (songKey(start) === songKey(end)) throw new NotFoundError("Pick two different songs for a journey.");

  const pool = new Map<string, JourneyCandidate>();
  const add = (t: Track, a: number, b: number) => {
    const k = songKey(t);
    const cur = pool.get(k);
    if (cur) {
      cur.matchA = Math.max(cur.matchA, a);
      cur.matchB = Math.max(cur.matchB, b);
    } else pool.set(k, { track: t, matchA: a, matchB: b });
  };

  const load = async (anchor: Track, side: "a" | "b", n: number) => {
    const sims = (await sources.lastfm.similarTracks(anchor, 60)).slice(0, n);
    const tracks = await mapLimit(sims, 12, async (s) => ({ s, t: await getTrack(s).catch(() => null) }));
    for (const { s, t } of tracks) {
      if (!t) continue;
      add(t, side === "a" && anchor === start ? s.match : 0, side === "b" && anchor === end ? s.match : 0);
    }
  };

  onProgress(`Exploring songs near ${start.title}…`, 0.1);
  await load(start, "a", 18);
  onProgress(`Exploring songs near ${end.title}…`, 0.28);
  await load(end, "b", 18);

  // Last.fm similarity never leaves a genre cluster, so plan a route *through genres* and
  // pull representative songs for each stop (e.g. thrash metal -> hard rock -> alternative rock -> indie -> electronic -> downtempo).
  const route = genrePath(start.tags, end.tags);
  const stops = samplePath(route, 8);
  let k = 0;
  for (const genre of stops) {
    onProgress(`Looking for ${genre} stepping stones…`, 0.45 + (0.45 * k++) / Math.max(1, stops.length));
    try {
      const top = (await sources.lastfm.tagTopTracks(genre, 14)).slice(0, 8);
      const tracks = await mapLimit(top, 12, (r) => getTrack(r).catch(() => null));
      for (const t of tracks) if (t) add(t, 0, 0);
    } catch {
      /* a failed genre just leaves a thinner pool */
    }
  }

  onProgress("Smoothing the transitions…", 0.93);
  const path: JourneyStep[] = planJourney(start, end, [...pool.values()], { steps, genrePath: route });

  onProgress("Done", 1);
  return { start, end, steps: path, mock: config.mock };
}
