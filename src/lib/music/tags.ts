/** Tag cleaning, weighting and the mood / energy lexicon. */
import { fold } from "./normalize";

/** Tags that carry no musical signal (user clutter, personal lists, years, etc.). */
const JUNK_TAGS = new Set([
  "seen live",
  "favorites",
  "favourites",
  "favorite",
  "favourite",
  "love",
  "loved",
  "awesome",
  "good",
  "great",
  "best",
  "my music",
  "owned",
  "albums i own",
  "spotify",
  "youtube",
  "under 2000 listeners",
  "all",
  "music",
  "song",
  "songs",
  "male vocalists",
  "female vocalists",
  "male vocalist",
  "female vocalist",
  "singer songwriter",
  "usa",
  "american",
  "british",
  "uk",
]);

/**
 * Tags come from user-generated content, so they are also an injection vector for the LLM prompt.
 * Keep only short, plain-text tags.
 */
export function sanitizeTag(raw: string): string | null {
  const nfkc = raw.normalize("NFKC");
  if (/[<>{}[\]()|\\;:"`$=@#*%^~_]/.test(nfkc)) return null; // markup / code-ish => drop, don't "repair"
  const t = nfkc
    .replace(/[^\p{L}\p{N} \-'&+/]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (t.length < 2 || t.length > 28) return null;
  if (/^\d{4}s?$/.test(t) && !/^\d0s$/.test(t) && !/^(19|20)\d0s$/.test(t)) return null; // bare years
  if (/^\d+$/.test(t)) return null;
  if (JUNK_TAGS.has(t)) return null;
  if (t.split(" ").length > 4) return null;
  return t;
}

export function cleanTags(raw: string[], max = 10): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = sanitizeTag(r);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Position-based weights: first tag counts most. */
export function tagWeights(tags: string[]): Map<string, number> {
  const m = new Map<string, number>();
  tags.forEach((t, i) => m.set(t, 1 / (1 + i * 0.35)));
  return m;
}

/** Weighted cosine similarity between two ordered tag lists (0..1). */
export function tagSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const wa = tagWeights(a);
  const wb = tagWeights(b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const w of wa.values()) na += w * w;
  for (const w of wb.values()) nb += w * w;
  for (const [t, w] of wa) {
    const o = wb.get(t);
    if (o) dot += w * o;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Sparse tag vector for interpolation (journey mode). */
export type TagVec = Map<string, number>;

export function tagVector(tags: string[]): TagVec {
  const v = tagWeights(tags);
  let n = 0;
  for (const w of v.values()) n += w * w;
  n = Math.sqrt(n) || 1;
  for (const [k, w] of v) v.set(k, w / n);
  return v;
}

export function lerpVec(a: TagVec, b: TagVec, t: number): TagVec {
  const out: TagVec = new Map();
  for (const [k, w] of a) out.set(k, (out.get(k) ?? 0) + w * (1 - t));
  for (const [k, w] of b) out.set(k, (out.get(k) ?? 0) + w * t);
  return out;
}

export function cosine(a: TagVec, b: TagVec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const w of a.values()) na += w * w;
  for (const w of b.values()) nb += w * w;
  for (const [k, w] of a) {
    const o = b.get(k);
    if (o) dot += w * o;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Shared tags, in the order they appear in `a`. */
export function sharedTags(a: string[], b: string[]): string[] {
  const set = new Set(b);
  return a.filter((t) => set.has(t));
}

/* ---------------------------------------------------------------- moods */

export interface Mood {
  id: string;
  label: string;
  emoji: string;
  /** Tag substrings that signal this mood. */
  keywords: string[];
}

export const MOODS: Mood[] = [
  { id: "chill", label: "Chill", emoji: "🌊", keywords: ["chill", "relax", "mellow", "ambient", "lounge", "downtempo", "calm", "soft", "easy listening"] },
  { id: "happy", label: "Happy", emoji: "☀️", keywords: ["happy", "feel good", "feelgood", "upbeat", "fun", "summer", "sunshine", "cheerful", "party", "uplifting"] },
  { id: "melancholy", label: "Melancholy", emoji: "🌧️", keywords: ["melanchol", "sad", "depress", "heartbreak", "lonely", "somber", "bittersweet", "emotional", "nostalgi"] },
  { id: "dreamy", label: "Dreamy", emoji: "✨", keywords: ["dream", "shoegaze", "ethereal", "atmospheric", "hazy", "psychedelic", "space", "lo-fi", "lofi"] },
  { id: "dark", label: "Dark", emoji: "🌑", keywords: ["dark", "gothic", "goth", "brood", "industrial", "doom", "noir", "creepy", "sinister"] },
  { id: "romantic", label: "Romantic", emoji: "💗", keywords: ["romantic", "love song", "sensual", "sexy", "slow jam", "intimate", "ballad", "soul"] },
  { id: "dance", label: "Dance", emoji: "🪩", keywords: ["dance", "disco", "house", "club", "edm", "techno", "groove", "funk", "electro"] },
  { id: "angry", label: "Aggressive", emoji: "🔥", keywords: ["aggressive", "angry", "hardcore", "punk", "metal", "thrash", "rage", "heavy"] },
];

export function moodStrength(tags: string[], moodId: string): number {
  const mood = MOODS.find((m) => m.id === moodId);
  if (!mood || !tags.length) return 0;
  const w = tagWeights(tags);
  let total = 0;
  let hit = 0;
  for (const [t, wt] of w) {
    total += wt;
    if (mood.keywords.some((k) => t.includes(k))) hit += wt;
  }
  return total ? Math.min(1, (hit / total) * 2.5) : 0;
}

/** -1 (very calm) .. +1 (very intense); only tags we know about contribute. */
const ENERGY_LEX: Array<[string, number]> = [
  ["ambient", -0.9], ["sleep", -0.95], ["drone", -0.8], ["chillout", -0.75], ["chill", -0.7], ["downtempo", -0.6],
  ["mellow", -0.7], ["lounge", -0.6], ["relax", -0.75], ["acoustic", -0.45], ["slow", -0.6], ["ballad", -0.5],
  ["lo-fi", -0.5], ["lofi", -0.5], ["calm", -0.8], ["soft", -0.55], ["folk", -0.35], ["classical", -0.4],
  ["piano", -0.4], ["new age", -0.7], ["dream pop", -0.35], ["shoegaze", -0.1], ["trip-hop", -0.3], ["trip hop", -0.3],
  ["soul", -0.1], ["jazz", -0.2], ["blues", -0.15], ["singer-songwriter", -0.4],
  ["indie", 0.1], ["pop", 0.2], ["alternative", 0.2], ["rock", 0.4], ["electronic", 0.3], ["electro", 0.45],
  ["funk", 0.4], ["disco", 0.5], ["dance", 0.6], ["house", 0.55], ["hip-hop", 0.3], ["hip hop", 0.3], ["rap", 0.35],
  ["hard rock", 0.7], ["garage", 0.5], ["grunge", 0.6], ["punk", 0.8], ["techno", 0.75], ["trance", 0.7],
  ["drum and bass", 0.85], ["dubstep", 0.8], ["metal", 0.9], ["hardcore", 0.95], ["thrash", 0.95], ["industrial", 0.7],
  ["party", 0.6], ["energetic", 0.8], ["aggressive", 0.9], ["heavy", 0.75], ["upbeat", 0.6],
];

export function tagEnergy(tags: string[]): number | null {
  if (!tags.length) return null;
  const w = tagWeights(tags);
  let sum = 0;
  let wsum = 0;
  for (const [t, wt] of w) {
    // prefer the longest matching key so "hard rock" beats "rock"
    let best: [string, number] | null = null;
    for (const e of ENERGY_LEX) {
      if (t.includes(e[0]) && (!best || e[0].length > best[0].length)) best = e;
    }
    if (best) {
      sum += best[1] * wt;
      wsum += wt;
    }
  }
  return wsum ? Math.max(-1, Math.min(1, sum / wsum)) : null;
}

export { fold };
