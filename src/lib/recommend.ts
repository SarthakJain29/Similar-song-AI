import { mapLimit } from "./cache";
import { applyHydration, fullTrack, getTrack, hydrate } from "./catalog";
import { planJourney, type JourneyCandidate } from "./music/journey";
import { songKey } from "./music/normalize";
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
  const pool = raw.slice(0, poolSize(vibe));
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
  const results: Recommendation[] = rankCandidates(seed, candidates, vibe, { limit });
  return { seed, results, mock: config.mock };
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

  const load = async (anchor: Track, side: "a" | "b" | "mid", n: number) => {
    const sims = (await sources.lastfm.similarTracks(anchor, 60)).slice(0, n);
    const tracks = await mapLimit(sims, 8, async (s) => ({ s, t: await getTrack(s).catch(() => null) }));
    for (const { s, t } of tracks) if (t) add(t, side === "a" ? s.match : 0, side === "b" ? s.match : 0);
  };

  onProgress(`Exploring songs near ${start.title}…`, 0.15);
  await load(start, "a", 26);
  onProgress(`Exploring songs near ${end.title}…`, 0.4);
  await load(end, "b", 26);

  onProgress("Sketching a first route…", 0.6);
  let path = planJourney(start, end, [...pool.values()], { steps });

  // Bridge expansion: look around waypoints of the first route to find better stepping stones.
  const waypoints = [path[Math.floor(path.length / 3)], path[Math.floor((2 * path.length) / 3)]].filter(Boolean);
  let i = 0;
  for (const w of waypoints) {
    onProgress(`Looking for stepping stones near ${w.track.title}…`, 0.65 + 0.12 * i++);
    await load(w.track, "mid", 16).catch(() => {});
  }
  onProgress("Smoothing the transitions…", 0.9);
  path = planJourney(start, end, [...pool.values()], { steps });

  const hydrated: JourneyStep[] = path;
  onProgress("Done", 1);
  return { start, end, steps: hydrated, mock: config.mock };
}
