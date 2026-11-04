import { fail, json } from "@/lib/api";
import { search } from "@/lib/catalog";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return json({ hits: [] });
  if (q.length > 120) return fail("Query too long");
  try {
    return json({ hits: await search(q, 8) }, { maxAge: 300 });
  } catch (e) {
    console.warn("[search]", e instanceof Error ? e.message : e);
    return fail("Search is temporarily unavailable", 502);
  }
}
