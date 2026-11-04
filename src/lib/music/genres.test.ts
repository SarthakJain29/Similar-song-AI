import { describe, expect, it } from "vitest";
import { genrePath, knownGenre, samplePath } from "./genres";

describe("genrePath", () => {
  it("routes across genre clusters via intermediate genres", () => {
    const p = genrePath(["thrash metal", "metal"], ["downtempo", "electronic"]);
    expect(["thrash metal", "metal"]).toContain(p[0]);
    expect(p[p.length - 1]).toMatch(/downtempo|electronic/);
    expect(p.length).toBeGreaterThan(2);
    // every hop is adjacent in the graph (no teleporting)
    p.forEach((g) => expect(knownGenre(g)).toBe(true));
  });
  it("returns a single genre when both ends share one", () => {
    expect(genrePath(["rock"], ["rock", "indie"])).toEqual(["rock"]);
  });
  it("returns [] for unknown tags", () => {
    expect(genrePath(["zzz"], ["metal"])).toEqual([]);
  });
  it("samples long routes evenly and keeps endpoints", () => {
    const s = samplePath(["a", "b", "c", "d", "e", "f", "g"], 4);
    expect(s[0]).toBe("a");
    expect(s[s.length - 1]).toBe("g");
    expect(s.length).toBeLessThanOrEqual(4);
  });
});
