/**
 * Journey planning: pick a path of tracks that drifts gradually from A to B.
 *
 * Every candidate has a tag vector. For step i of n the "ideal" point is the
 * interpolation between A's and B's vectors at progress (i / (n+1)). We greedily
 * choose the unused candidate that is closest to the ideal point, with a bonus for
 * being close to the previous pick (smooth transitions) and for appearing in
 * Last.fm's similar lists of A/B near the matching end.
 */
import type { JourneyStep, Track } from "../types";
import { cleanArtist, fold, songKey } from "./normalize";
import { cosine, lerpVec, sharedTags, tagVector, type TagVec } from "./tags";

export interface JourneyCandidate {
  track: Track;
  /** Last.fm similarity to A / B if it appeared in their similar lists (0 otherwise). */
  matchA: number;
  matchB: number;
}

export interface JourneyOptions {
  steps: number;
  maxPerArtist?: number;
}

export function planJourney(start: Track, end: Track, pool: JourneyCandidate[], opts: JourneyOptions): JourneyStep[] {
  const { steps, maxPerArtist = 1 } = opts;
  const vA = tagVector(start.tags);
  const vB = tagVector(end.tags);
  const used = new Set<string>([songKey(start), songKey(end)]);
  const perArtist = new Map<string, number>();
  perArtist.set(fold(cleanArtist(start.artist)), 1);
  perArtist.set(fold(cleanArtist(end.artist)), 1);

  const vecs = new Map<string, TagVec>();
  const vecOf = (t: Track) => {
    const k = songKey(t);
    let v = vecs.get(k);
    if (!v) vecs.set(k, (v = tagVector(t.tags)));
    return v;
  };

  const out: JourneyStep[] = [];
  let prev: Track = start;
  for (let i = 1; i <= steps; i++) {
    const progress = i / (steps + 1);
    const ideal = lerpVec(vA, vB, progress);
    let best: { c: JourneyCandidate; score: number } | null = null;
    for (const c of pool) {
      const k = songKey(c.track);
      if (used.has(k) || !c.track.tags.length) continue;
      const artist = fold(cleanArtist(c.track.artist));
      if ((perArtist.get(artist) ?? 0) >= maxPerArtist) continue;
      const v = vecOf(c.track);
      const onPath = cosine(v, ideal);
      const smooth = cosine(v, vecOf(prev));
      const lastfm = (1 - progress) * c.matchA + progress * c.matchB;
      const score = 0.55 * onPath + 0.3 * smooth + 0.15 * lastfm;
      if (!best || score > best.score) best = { c, score };
    }
    if (!best) break;
    const t = best.c.track;
    used.add(songKey(t));
    const a = fold(cleanArtist(t.artist));
    perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
    out.push({
      track: t,
      progress,
      sharedWithPrev: sharedTags(t.tags, prev.tags),
      sharedWithEnd: sharedTags(t.tags, end.tags),
    });
    prev = t;
  }
  return out;
}

/** Cosine of a track to the endpoints, used for tests and UI "drift" indicators. */
export function driftToward(track: Track, start: Track, end: Track): { a: number; b: number } {
  const v = tagVector(track.tags);
  return { a: cosine(v, tagVector(start.tags)), b: cosine(v, tagVector(end.tags)) };
}
