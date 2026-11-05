import { fail, json, rateLimit, str } from "@/lib/api";
import { NotFoundError, similar } from "@/lib/recommend";
import { DEFAULT_VIBE, type VibeSettings } from "@/lib/types";
import { MOODS } from "@/lib/music/tags";

export const maxDuration = 60;

const slider = (v: string | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
};

export async function GET(req: Request) {
  if (!rateLimit(req, "similar", 40, 60_000)) return fail("Slow down a little", 429);
  const sp = new URL(req.url).searchParams;
  const artist = str(sp.get("artist"));
  const title = str(sp.get("title"));
  if (!artist || !title) return fail("artist and title are required");
  const validMoods = new Set(MOODS.map((m) => m.id));
  const vibe: VibeSettings = {
    ...DEFAULT_VIBE,
    popularity: slider(sp.get("popularity")),
    era: slider(sp.get("era")),
    energy: slider(sp.get("energy")),
    moods: (sp.get("moods") ?? "").split(",").filter((m) => validMoods.has(m)),
  };
  const limit = Math.min(30, Math.max(5, Number(sp.get("limit")) || 12));
  try {
    return json(await similar({ artist, title }, vibe, limit), { maxAge: 600 });
  } catch (e) {
    if (e instanceof NotFoundError) return fail(e.message, 404);
    console.warn("[similar]", e instanceof Error ? e.message : e);
    return fail("Couldn't fetch similar songs right now. Please try again.", 502);
  }
}
