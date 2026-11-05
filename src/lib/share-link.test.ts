import { describe, expect, it } from "vitest";
import { decodePlaylist, encodePlaylist, MAX_SHARED_TRACKS, sharedToPlaylistTracks } from "./share-link";

const tracks = Array.from({ length: 12 }, (_, i) => ({ artist: `Artist ${i}`, title: `Song número ${i} — ✨` }));

describe("share links", () => {
  it("round-trips name and tracks (unicode safe), URL-safe and compact", async () => {
    const code = await encodePlaylist("Late night glow 🌙", tracks);
    expect(code).toMatch(/^[01]\.[A-Za-z0-9_-]+$/);
    const back = await decodePlaylist(code);
    expect(back).toEqual({ name: "Late night glow 🌙", tracks });
    expect(code.length).toBeLessThan(JSON.stringify(tracks).length);
  });
  it("caps track count", async () => {
    const many = Array.from({ length: 100 }, (_, i) => ({ artist: "A", title: `T${i}` }));
    expect((await decodePlaylist(await encodePlaylist("x", many)))!.tracks).toHaveLength(MAX_SHARED_TRACKS);
  });
  it("rejects malformed or hostile input", async () => {
    for (const bad of ["", "garbage", "9.abc", "1.@@@", "0." + btoa("{}"), "0." + btoa('{"n":"x","t":[[1,2]]}'), "0." + "A".repeat(9000)]) {
      expect(await decodePlaylist(bad)).toBeNull();
    }
  });
  it("builds playlist tracks with stable ids", async () => {
    const p = (await decodePlaylist(await encodePlaylist("x", tracks)))!;
    expect(sharedToPlaylistTracks(p)[0].id).toBe("artist 0::song numero 0");
  });
});
