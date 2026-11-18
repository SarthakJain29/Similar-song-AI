import { DAY, HOUR, TTLCache } from "../cache";
import { activeProviders } from "./index";
import { checkGrounding } from "./grounding";
import { type ExplainFacts } from "./facts";
import { templateExplanation } from "./template";
import type { Explanation } from "../types";

const SYSTEM = `You write short "why it's similar" blurbs for a music recommendation app.

STRICT RULES
- Use ONLY the facts in the provided JSON. Do not use any outside knowledge about the songs, artists, albums, lyrics, instruments, production, history or reception.
- If the facts are thin, write less. Never pad with generic praise or guesses.
- One sentence, max 24 words, plain text, friendly and specific. No markdown, quotes or emojis.
- No subjective praise or poetry (never "beautiful", "iconic", "anthem", "haunting", "masterpiece"); only describe what the data shows.
- Mention concrete shared tags when available. You may mention the Last.fm similarity score (lastfmMatchPercent: a 0-100 score based on listening patterns, not an overlap percentage), popularity wording, release years, or same-artist when the facts include them.
- Write like a knowledgeable friend: weave the tags into natural phrasing (e.g. "Another French electronic groove with the same dance-floor leanings") instead of just listing them, and vary the sentence openings across items.
- Refer to songs by the names given. Do not introduce any other names.
- For journey items: explain what the song keeps from the previous song and how it leans toward the destination, using only listed tags.
- "evidence" must list the exact tag strings (copied verbatim) and/or the keys lastfmMatch, sameArtist, popularity, year, album that your sentence relies on.

OUTPUT: a JSON object {"items":[{"id":"<id>","text":"<sentence>","evidence":["..."]}]} with one entry per input item and nothing else.`;

const cache = new TTLCache<Explanation>(5000);

function factsKey(f: ExplainFacts) {
  return JSON.stringify([f.id, f.reference, f.sharedTags, f.targetOnlyTags.slice(0, 3), f.lastfmMatchPercent, f.journey?.destination]);
}

async function askLLM(batch: ExplainFacts[]): Promise<Map<string, Explanation>> {
  const out = new Map<string, Explanation>();
  const user = JSON.stringify({ items: batch });
  for (const provider of activeProviders()) {
    try {
      const t0 = Date.now();
      const raw = await provider.completeJSON({ system: SYSTEM, user, maxTokens: 1800 });
      if (process.env.DEBUG_TIMING) console.log(`[explain] ${provider.name} answered in ${Date.now() - t0}ms for ${batch.length} items`);
      const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { items?: Array<{ id?: string; text?: string; evidence?: unknown }> };
      for (const it of parsed.items ?? []) {
        const f = batch.find((b) => b.id === it.id);
        if (!f || !it.text) continue;
        const verdict = checkGrounding(it.text, it.evidence, f);
        if (verdict.ok) out.set(f.id, { id: f.id, text: it.text.trim(), evidence: verdict.evidence, source: "llm" });
        else if (process.env.DEBUG_TIMING) console.warn(`[explain] rejected (${verdict.reason}): ${it.text} :: ${JSON.stringify(it.evidence)}`);
      }
      if (out.size) return out;
    } catch (e) {
      console.warn(`[explain] ${provider.name} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

/** Explain a batch of suggestions. Always returns one explanation per input (LLM when possible, template otherwise). */
export async function explainBatch(items: ExplainFacts[]): Promise<Explanation[]> {
  const result = new Map<string, Explanation>();
  const missing: ExplainFacts[] = [];
  for (const f of items) {
    const hit = cache.get(factsKey(f));
    if (hit) result.set(f.id, hit);
    else missing.push(f);
  }
  if (missing.length && activeProviders().length) {
    const llm = await askLLM(missing);
    for (const [id, e] of llm) {
      const f = missing.find((m) => m.id === id)!;
      cache.set(factsKey(f), e, 7 * DAY);
      result.set(id, e);
    }
  }
  for (const f of missing) {
    if (result.has(f.id)) continue;
    const t = templateExplanation(f);
    // retry the LLM later for template-only entries
    cache.set(factsKey(f), t, activeProviders().length ? 5 * 60_000 : HOUR);
    result.set(f.id, t);
  }
  return items.map((f) => result.get(f.id)!);
}

