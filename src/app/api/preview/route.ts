import { fail, json, str } from "@/lib/api";
import { hydrate } from "@/lib/catalog";
import { sources } from "@/lib/sources";

/**
 * Resolves a *fresh* 30s preview URL. Deezer signs them and they expire in ~15 min,
 * so they are never stored in saved playlists or long-lived caches.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  let id = Number(sp.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    const artist = str(sp.get("artist"));
    const title = str(sp.get("title"));
    if (!artist || !title) return fail("id or artist+title required");
    id = (await hydrate({ artist, title })).deezerId ?? 0;
  }
  if (!id) return json({ url: null }, { maxAge: 60 });
  const d = await sources.deezer.details(id).catch(() => null);
  return json({ url: d?.previewUrl ?? null }, { maxAge: 120 });
}
