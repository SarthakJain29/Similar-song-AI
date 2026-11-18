import { describe, expect, it } from "vitest";
import type { ExplainFacts } from "./facts";
import { checkGrounding } from "./grounding";
import { templateExplanation } from "./template";

const facts: ExplainFacts = {
  id: "stromae::alors on danse",
  reference: "Get Lucky — Daft Punk",
  referenceRole: "seed",
  target: "Alors on danse — Stromae",
  album: "Cheese",
  sharedTags: ["electronic", "dance"],
  targetOnlyTags: ["belgian", "french"],
  referenceOnlyTags: ["disco"],
  lastfmMatchPercent: 17,
  sameArtist: false,
  popularity: "mainstream",
  targetYear: 2010,
  referenceYear: 2013,
};

describe("checkGrounding", () => {
  it("accepts text built from the facts", () => {
    const r = checkGrounding("Alors on danse brings the same electronic dance energy as Get Lucky, with a French twist.", ["electronic", "dance", "french"], facts);
    expect(r.ok).toBe(true);
  });
  it("accepts lenient evidence formatting", () => {
    const r = checkGrounding("Shares electronic and dance tags; Last.fm rates it 17% similar.", ["tag: electronic", "lastfmMatchPercent"], facts);
    expect(r.ok).toBe(true);
  });
  it("rejects invented numbers", () => {
    const r = checkGrounding("It was a number 1 hit in 2011 with electronic beats.", ["electronic"], facts);
    expect(r).toMatchObject({ ok: false });
  });
  it("rejects invented proper nouns", () => {
    const r = checkGrounding("Produced by Pharrell with electronic beats.", ["electronic"], facts);
    expect(r).toMatchObject({ ok: false });
  });
  it("rejects missing / fake evidence, links and markdown", () => {
    expect(checkGrounding("Nice electronic dance track.", [], facts).ok).toBe(false);
    expect(checkGrounding("Nice electronic dance track.", ["jazz"], facts).ok).toBe(false);
    expect(checkGrounding("See https://x.com for electronic.", ["electronic"], facts).ok).toBe(false);
    expect(checkGrounding("**Electronic** dance.", ["electronic"], facts).ok).toBe(false);
  });
});

describe("templateExplanation", () => {
  it("only mentions facts it was given", () => {
    const e = templateExplanation(facts);
    expect(e.source).toBe("template");
    expect(e.text).toContain("electronic");
    expect(e.text).toContain("17%");
    expect(checkGrounding(e.text, e.evidence, facts).ok).toBe(true);
  });
  it("handles zero shared tags and journey mode", () => {
    const none = templateExplanation({ ...facts, sharedTags: [] });
    expect(none.text.length).toBeGreaterThan(10);
    const j = templateExplanation({ ...facts, journey: { destination: "Song — B", sharedWithDestination: ["dance"], step: 2, of: 6 } });
    expect(j.text).toContain("dance");
  });
});
