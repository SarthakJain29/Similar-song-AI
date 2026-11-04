import { beforeAll, describe, expect, it } from "vitest";
import { search } from "./catalog";
import { explainJourney, explainSimilar } from "./explain-service";
import { journey, similar } from "./recommend";
import { DEFAULT_VIBE } from "./types";

// End-to-end through the mock data sources (no network, no keys).
beforeAll(() => {
  process.env.MOCK_MODE = "1";
  process.env.LLM_PROVIDER = "none";
});

describe("mock end-to-end", () => {
  it("searches the bundled catalogue", async () => {
    const hits = await search("creep");
    expect(hits[0]).toMatchObject({ artist: "Radiohead", title: "Creep" });
    expect(hits[0].artwork).toMatch(/^data:image\/svg/);
  });
  it("returns similar songs with shared tags, never the seed", async () => {
    const res = await similar({ artist: "Radiohead", title: "Creep" }, DEFAULT_VIBE, 8);
    expect(res.mock).toBe(true);
    expect(res.results.length).toBeGreaterThan(3);
    expect(res.results.some((r) => r.track.title === "Creep")).toBe(false);
    expect(res.results[0].sharedTags.length).toBeGreaterThan(0);
  });
  it("vibe controls change the results", async () => {
    const calm = await similar({ artist: "Radiohead", title: "Creep" }, { ...DEFAULT_VIBE, energy: -1 }, 5);
    const loud = await similar({ artist: "Radiohead", title: "Creep" }, { ...DEFAULT_VIBE, energy: 1 }, 5);
    expect(calm.results.map((r) => r.track.id)).not.toEqual(loud.results.map((r) => r.track.id));
  });
  it("rejects unknown songs", async () => {
    await expect(similar({ artist: "Nobody", title: "Nothing" }, DEFAULT_VIBE)).rejects.toThrow();
  });
  it("builds a journey between distant songs", async () => {
    const msgs: string[] = [];
    const res = await journey({ artist: "Metallica", title: "Master of Puppets" }, { artist: "Bonobo", title: "Kerala" }, 6, (m) => msgs.push(m));
    expect(res.steps.length).toBeGreaterThanOrEqual(4);
    expect(msgs.length).toBeGreaterThan(2);
  });
  it("falls back to grounded template explanations without an LLM", async () => {
    const ex = await explainSimilar({ artist: "Radiohead", title: "Creep" }, [{ artist: "Nirvana", title: "Smells Like Teen Spirit" }]);
    expect(ex).toHaveLength(1);
    expect(ex[0].source).toBe("template");
    expect(ex[0].text).toMatch(/grunge|alternative rock/);
    const j = await explainJourney({ artist: "Metallica", title: "Master of Puppets" }, { artist: "Bonobo", title: "Kerala" }, [{ artist: "Black Sabbath", title: "Paranoid" }]);
    expect(j[0].text.length).toBeGreaterThan(10);
  });
});
