import type { Recommendation, Track, VibeSettings } from "../types";
import { cleanArtist, fold, songKey } from "./normalize";
import { moodStrength, sharedTags, tagEnergy, tagSimilarity } from "./tags";

export interface Candidate {
  track: Track;
  /** Last.fm similarity to the seed, 0..1. */
  match: number;
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

/** Map unique-listener counts onto 0..1 on a log scale (1k ≈ 0, ~6M ≈ 1). */
export function popularityScore(listeners?: number): number {
  if (!listeners || listeners <= 0) return 0.15;
  return clamp((Math.log10(listeners) - 3.2) / (6.8 - 3.2));
}

/** 1960 ≈ 0 ... 2026 ≈ 1. Unknown → null. */
export function eraScore(year?: number): number | null {
  if (!year) return null;
  return clamp((year - 1960) / (new Date().getFullYear() - 1960));
}

export interface ScoreParts {
  base: number;
  vibe: number;
}

export function scoreCandidate(seed: Track, c: Candidate, vibe: VibeSettings): Recommendation & { parts: ScoreParts } {
  const tagSim = tagSimilarity(seed.tags, c.track.tags);
  const popularity = popularityScore(c.track.listeners);

  // Signed biases: 0 at the neutral slider position, ±1 for perfectly aligned items.
  const popBias = vibe.popularity * (popularity - 0.5) * 2;
  const era = eraScore(c.track.year);
  const eraBias = era === null ? 0 : vibe.era * (era - 0.5) * 2;
  const en = tagEnergy(c.track.tags);
  const energyBias = en === null ? 0 : vibe.energy * en;

  let moodFit = 0;
  if (vibe.moods.length) {
    const strengths = vibe.moods.map((m) => moodStrength(c.track.tags, m));
    // reward matching ANY chosen mood, but a bit more for matching several
    const max = Math.max(...strengths);
    const mean = strengths.reduce((a, b) => a + b, 0) / strengths.length;
    moodFit = 0.7 * max + 0.3 * mean - 0.25; // slightly negative when nothing matches
  }

  const base = 0.55 * clamp(c.match) + 0.45 * tagSim;
  const vibeScore = 0.5 * popBias + 0.4 * eraBias + 0.45 * energyBias + 0.7 * moodFit;
  return {
    track: c.track,
    score: base + vibeScore,
    match: c.match,
    sharedTags: sharedTags(seed.tags, c.track.tags),
    popularity,
    parts: { base, vibe: vibeScore },
  };
}

export interface RankOptions {
  limit?: number;
  maxPerArtist?: number;
}

/** Rank candidates, drop the seed itself and near-duplicate editions, keep artists diverse. */
export function rankCandidates(seed: Track, candidates: Candidate[], vibe: VibeSettings, opts: RankOptions = {}): Recommendation[] {
  const { limit = 15, maxPerArtist = 2 } = opts;
  const seedKey = songKey(seed);
  const seen = new Set<string>([seedKey]);
  const unique: Candidate[] = [];
  for (const c of candidates) {
    const k = songKey(c.track);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(c);
  }
  const scored = unique
    .map((c) => scoreCandidate(seed, c, vibe))
    .sort((a, b) => b.score - a.score)
    .map((r) => ({ track: r.track, score: r.score, match: r.match, sharedTags: r.sharedTags, popularity: r.popularity }));

  const perArtist = new Map<string, number>();
  const out: Recommendation[] = [];
  for (const r of scored) {
    const a = fold(cleanArtist(r.track.artist));
    const n = perArtist.get(a) ?? 0;
    if (n >= maxPerArtist) continue;
    perArtist.set(a, n + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** True when the user moved any vibe control away from neutral. */
export function hasVibe(v: VibeSettings): boolean {
  return v.popularity !== 0 || v.era !== 0 || v.energy !== 0 || v.moods.length > 0;
}
