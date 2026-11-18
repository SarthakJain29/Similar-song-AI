import { fail, json, str } from "@/lib/api";
import { hydrate } from "@/lib/catalog";

/** Lazy Deezer enrichment (artwork, year, preview availability) for one track. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const artist = str(sp.get("artist"));
  const title = str(sp.get("title"));
  if (!artist || !title) return fail("artist and title are required");
  return json(await hydrate({ artist, title }), { maxAge: 3600 });
}
