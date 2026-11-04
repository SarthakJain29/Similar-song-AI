import { fail, json, rateLimit, ref } from "@/lib/api";
import { explainJourney, explainSimilar } from "@/lib/explain-service";

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!rateLimit(req, "explain", 30, 60_000)) return fail("Slow down a little", 429);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 20).map(ref) : [];
  if (!items.length || items.some((i) => !i)) return fail("items must be [{artist,title}]");
  const clean = items as Array<{ artist: string; title: string }>;
  try {
    if (body.mode === "journey") {
      const start = ref(body.start);
      const end = ref(body.end);
      if (!start || !end) return fail("start and end are required for journey mode");
      return json({ explanations: await explainJourney(start, end, clean) });
    }
    const seed = ref(body.seed);
    if (!seed) return fail("seed is required");
    return json({ explanations: await explainSimilar(seed, clean) });
  } catch (e) {
    console.warn("[explain]", e instanceof Error ? e.message : e);
    return fail("Couldn't generate explanations", 502);
  }
}
