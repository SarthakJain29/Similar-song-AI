import { getTrack, hydrate, applyHydration } from "./catalog";
import type { ExplainFacts } from "./llm/facts";
import { explainBatch } from "./llm/explain";
import { cleanArtist, cleanTitle, fold, trackId } from "./music/normalize";
import { popularityScore } from "./music/scoring";
import { sharedTags } from "./music/tags";
import { sources } from "./sources";
import type { Explanation, Track, TrackRef } from "./types";
import { mapLimit } from "./cache";

const label = (t: Track) => `${cleanTitle(t.title)} — ${cleanArtist(t.artist)}`;
const popularityWord = (t: Track): ExplainFacts["popularity"] => {
  const p = popularityScore(t.listeners);
  return p < 0.4 ? "niche" : p < 0.7 ? "well-known" : "mainstream";
};

async function load(ref: TrackRef): Promise<Track | null> {
  const t = await getTrack(ref);
  if (!t) return null;
  return applyHydration(t, await hydrate(t));
}

function baseFacts(ref: Track, target: Track): Omit<ExplainFacts, "referenceRole" | "journey"> {
  return {
    id: target.id,
    reference: label(ref),
    target: label(target),
    album: target.album,
    sharedTags: sharedTags(target.tags, ref.tags).slice(0, 4),
    targetOnlyTags: target.tags.filter((t) => !ref.tags.includes(t)).slice(0, 4),
    referenceOnlyTags: ref.tags.filter((t) => !target.tags.includes(t)).slice(0, 3),
    sameArtist: fold(cleanArtist(ref.artist)) === fold(cleanArtist(target.artist)),
    popularity: popularityWord(target),
    targetYear: target.year,
    referenceYear: ref.year,
  };
}

/** Explain "why is each of `items` similar to `seed`". Facts are rebuilt server-side from cached data. */
export async function explainSimilar(seedRef: TrackRef, itemRefs: TrackRef[]): Promise<Explanation[]> {
  const seed = await load(seedRef);
  if (!seed) return [];
  const sims = await sources.lastfm.similarTracks(seed, 100).catch(() => []);
  const matchOf = new Map(sims.map((s) => [trackId(s), s.match]));
  const facts = (
    await mapLimit(itemRefs, 6, async (r) => {
      const t = await load(r);
      if (!t) return null;
      const m = matchOf.get(t.id);
      const f: ExplainFacts = {
        ...baseFacts(seed, t),
        referenceRole: "seed",
        lastfmMatchPercent: m !== undefined ? Math.round(m * 100) : undefined,
      };
      return f;
    })
  ).filter((f): f is ExplainFacts => f !== null);
  return explainBatch(facts);
}

/** Explain each stop of a journey relative to the previous stop and the destination. */
export async function explainJourney(startRef: TrackRef, endRef: TrackRef, stepRefs: TrackRef[]): Promise<Explanation[]> {
  const [start, end] = await Promise.all([load(startRef), load(endRef)]);
  if (!start || !end) return [];
  const tracks = await mapLimit(stepRefs, 6, load);
  const facts: ExplainFacts[] = [];
  let prev = start;
  tracks.forEach((t, i) => {
    if (!t) return;
    facts.push({
      ...baseFacts(prev, t),
      referenceRole: "previous-in-journey",
      journey: { destination: label(end), sharedWithDestination: sharedTags(t.tags, end.tags).slice(0, 3), step: i + 1, of: stepRefs.length },
    });
    prev = t;
  });
  return explainBatch(facts);
}
