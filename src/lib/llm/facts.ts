/** The ONLY information the LLM is allowed to use when explaining a suggestion. */
export interface ExplainFacts {
  /** Candidate track id (cache + response key). */
  id: string;
  /** What the candidate is compared to. */
  reference: string;
  referenceRole: "seed" | "previous-in-journey";
  target: string;
  album?: string;
  sharedTags: string[];
  targetOnlyTags: string[];
  referenceOnlyTags: string[];
  /** Last.fm similarity score derived from listening patterns, 0-100 (NOT an overlap percentage). */
  lastfmMatchPercent?: number;
  sameArtist: boolean;
  popularity: "niche" | "well-known" | "mainstream";
  targetYear?: number;
  referenceYear?: number;
  /** Journey mode only. */
  journey?: { destination: string; sharedWithDestination: string[]; step: number; of: number };
}

/** Tokens the model may cite as evidence. */
export function allowedEvidence(f: ExplainFacts): Set<string> {
  const s = new Set<string>([...f.sharedTags, ...f.targetOnlyTags, ...f.referenceOnlyTags, ...(f.journey?.sharedWithDestination ?? [])]);
  s.add("lastfmMatch");
  s.add("sameArtist");
  s.add("popularity");
  s.add("year");
  s.add("album");
  return s;
}

/** Everything that appears in the facts, as one string, for grounding checks. */
export function factsCorpus(f: ExplainFacts): string {
  return [
    f.reference,
    f.target,
    f.album ?? "",
    ...f.sharedTags,
    ...f.targetOnlyTags,
    ...f.referenceOnlyTags,
    f.journey?.destination ?? "",
    ...(f.journey?.sharedWithDestination ?? []),
    f.popularity,
    "Last.fm",
  ].join(" ");
}

export function allowedNumbers(f: ExplainFacts): Set<string> {
  const nums = new Set<string>();
  const add = (n?: number) => n !== undefined && Number.isFinite(n) && nums.add(String(Math.round(n)));
  add(f.lastfmMatchPercent);
  add(f.targetYear);
  add(f.referenceYear);
  if (f.targetYear && f.referenceYear) add(Math.abs(f.targetYear - f.referenceYear));
  if (f.journey) {
    add(f.journey.step);
    add(f.journey.of);
  }
  for (const m of factsCorpus(f).matchAll(/\d+/g)) nums.add(m[0]);
  return nums;
}
