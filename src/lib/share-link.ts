/**
 * Shareable playlist links: the playlist is encoded into the URL itself (no server storage).
 * Format: "<v>.<base64url>" where v=1 means the JSON was deflate-compressed, v=0 plain.
 * Only {name, [artist,title] pairs} travel in the link; artwork/previews are re-resolved by the receiver.
 */
import { trackId } from "./music/normalize";
import type { PlaylistTrack } from "./types";

export const MAX_SHARED_TRACKS = 40;

export interface SharedPlaylist {
  name: string;
  tracks: Array<{ artist: string; title: string }>;
}

const b64 = {
  enc(bytes: Uint8Array): string {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(text: string): Uint8Array {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(s, (c) => c.charCodeAt(0));
  },
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function encodePlaylist(name: string, tracks: Array<{ artist: string; title: string }>): Promise<string> {
  const payload = { n: name.slice(0, 80), t: tracks.slice(0, MAX_SHARED_TRACKS).map((t) => [t.artist, t.title]) };
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof CompressionStream !== "undefined") return `1.${b64.enc(await pipe(raw, new CompressionStream("deflate-raw")))}`;
  return `0.${b64.enc(raw)}`;
}

/** Returns null for anything malformed: links are untrusted input. */
export async function decodePlaylist(code: string): Promise<SharedPlaylist | null> {
  try {
    if (code.length > 8000) return null;
    const [v, body] = [code.slice(0, 2), code.slice(2)];
    let bytes = b64.dec(body);
    if (v === "1.") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    else if (v !== "0.") return null;
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { n?: unknown; t?: unknown };
    if (typeof data.n !== "string" || !Array.isArray(data.t)) return null;
    const tracks = data.t
      .slice(0, MAX_SHARED_TRACKS)
      .filter((p): p is [string, string] => Array.isArray(p) && typeof p[0] === "string" && typeof p[1] === "string" && p[0].length < 200 && p[1].length < 200)
      .map(([artist, title]) => ({ artist, title }));
    if (!tracks.length) return null;
    return { name: data.n.slice(0, 80) || "Shared playlist", tracks };
  } catch {
    return null;
  }
}


export function sharedToPlaylistTracks(p: SharedPlaylist): PlaylistTrack[] {
  return p.tracks.map((t) => ({ ...t, id: trackId(t) }));
}
