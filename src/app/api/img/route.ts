/**
 * Same-origin image proxy, only used so the share-card canvas can read artwork pixels
 * (Deezer's CDN doesn't always send CORS headers). Strictly allow-listed.
 */
const ALLOWED = /^https:\/\/(?:[a-z0-9-]+\.)*(?:dzcdn\.net|deezer\.com)\//i;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("u") ?? "";
  if (!ALLOWED.test(url)) return new Response("Forbidden host", { status: 403 });
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) return new Response("Bad upstream", { status: 502 });
    return new Response(upstream.body, {
      headers: { "Content-Type": upstream.headers.get("content-type")!, "Cache-Control": "public, max-age=604800, immutable" },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}
