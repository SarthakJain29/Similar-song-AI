/**
 * A small hand-made genre adjacency graph. Last.fm's similarity graph stays inside a genre
 * cluster, so to bridge e.g. thrash metal -> downtempo we first plan a route *through genres*
 * (BFS here), then fetch representative songs for each genre on the route.
 */
const EDGES: Array<[string, string]> = [
  ["thrash metal", "metal"], ["heavy metal", "metal"], ["death metal", "metal"], ["metal", "hard rock"], ["metal", "hardcore"], ["metal", "industrial"],
  ["hard rock", "rock"], ["hard rock", "classic rock"], ["hard rock", "grunge"], ["classic rock", "rock"], ["blues rock", "rock"], ["blues", "blues rock"],
  ["punk", "rock"], ["punk", "pop punk"], ["punk", "hardcore"], ["punk", "post-punk"], ["ska", "punk"], ["emo", "punk"], ["emo", "indie rock"], ["pop punk", "pop rock"],
  ["grunge", "alternative rock"], ["rock", "alternative rock"], ["rock", "indie rock"], ["rock", "pop rock"], ["rock", "psychedelic"], ["pop rock", "pop"],
  ["alternative rock", "alternative"], ["alternative rock", "indie rock"], ["alternative rock", "britpop"], ["alternative rock", "shoegaze"],
  ["indie rock", "indie"], ["indie rock", "post-punk"], ["indie rock", "post-rock"], ["indie", "indie pop"], ["indie", "indie folk"], ["indie", "indietronica"], ["indie", "psychedelic"],
  ["post-punk", "new wave"], ["new wave", "synthpop"], ["synthpop", "pop"], ["synthpop", "electronic"], ["synthpop", "synthwave"], ["synthwave", "electronic"],
  ["indie pop", "pop"], ["indie pop", "dream pop"], ["dream pop", "shoegaze"], ["dream pop", "chillwave"], ["chillwave", "electronic"], ["indietronica", "electronic"],
  ["pop", "dance"], ["pop", "r&b"], ["pop", "electropop"], ["pop", "singer-songwriter"], ["electropop", "electronic"], ["pop", "latin"],
  ["dance", "house"], ["dance", "disco"], ["house", "electronic"], ["electronic", "techno"], ["electronic", "trip-hop"], ["electronic", "downtempo"], ["electronic", "ambient"], ["electronic", "idm"], ["electronic", "industrial"], ["techno", "trance"],
  ["downtempo", "chillout"], ["downtempo", "trip-hop"], ["downtempo", "lo-fi"], ["trip-hop", "hip-hop"], ["chillout", "ambient"], ["chillout", "lounge"], ["ambient", "new age"], ["ambient", "post-rock"], ["ambient", "classical"], ["classical", "piano"], ["piano", "ambient"],
  ["hip-hop", "rap"], ["hip-hop", "r&b"], ["hip-hop", "lo-fi"], ["rap", "hip hop"], ["r&b", "soul"], ["soul", "funk"], ["soul", "jazz"], ["funk", "disco"], ["jazz", "blues"], ["blues", "soul"], ["jazz", "lounge"],
  ["folk", "indie folk"], ["folk", "country"], ["folk", "acoustic"], ["folk", "singer-songwriter"], ["country", "rock"], ["acoustic", "singer-songwriter"], ["indie folk", "singer-songwriter"],
  ["reggae", "ska"], ["reggae", "hip-hop"], ["psychedelic", "psychedelic rock"], ["psychedelic rock", "rock"], ["electronic", "electronica"], ["electronica", "downtempo"],
];

const ADJ = new Map<string, string[]>();
for (const [a, b] of EDGES) {
  (ADJ.get(a) ?? ADJ.set(a, []).get(a)!).push(b);
  (ADJ.get(b) ?? ADJ.set(b, []).get(b)!).push(a);
}

export const knownGenre = (t: string) => ADJ.has(t);

/**
 * Shortest genre route between the two tag lists (tag order = relevance).
 * Returns e.g. ["thrash metal","metal","hard rock","rock","alternative rock","indie","indietronica","electronic","downtempo"].
 */
export function genrePath(from: string[], to: string[]): string[] {
  const sources = from.filter(knownGenre).slice(0, 4);
  const targets = new Set(to.filter(knownGenre).slice(0, 4));
  if (!sources.length || !targets.size) return [];
  let best: string[] = [];
  for (const src of sources) {
    const prev = new Map<string, string | null>([[src, null]]);
    const queue = [src];
    let hit: string | null = null;
    for (let i = 0; i < queue.length && !hit; i++) {
      const cur = queue[i];
      if (targets.has(cur)) {
        hit = cur;
        break;
      }
      for (const n of ADJ.get(cur) ?? []) {
        if (!prev.has(n)) {
          prev.set(n, cur);
          queue.push(n);
        }
      }
    }
    if (!hit) continue;
    const path: string[] = [];
    for (let c: string | null = hit; c; c = prev.get(c) ?? null) path.unshift(c);
    if (!best.length || path.length < best.length) best = path;
  }
  return best;
}

/** Pick at most `n` evenly spaced genres from a route, always keeping the endpoints. */
export function samplePath(path: string[], n: number): string[] {
  if (path.length <= n) return path;
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(path[Math.round((i * (path.length - 1)) / (n - 1))]);
  return [...new Set(out)];
}
