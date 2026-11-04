import { describe, expect, it } from "vitest";
import { driftToward, planJourney, type JourneyCandidate } from "./journey";
import type { Track } from "../types";

const t = (n: string, tags: string[]): Track => ({ id: n, artist: `Artist ${n}`, title: n, tags });
const start = t("A", ["rock", "grunge", "90s", "alternative"]);
const end = t("B", ["house", "electronic", "dance", "french"]);

const pool: JourneyCandidate[] = [
  ["a1", ["rock", "grunge", "alternative"]],
  ["a2", ["rock", "alternative", "indie"]],
  ["m1", ["alternative", "indie", "electronic"]],
  ["m2", ["indie", "electronic", "synthpop"]],
  ["m3", ["electronic", "synthpop", "dance"]],
  ["b1", ["electronic", "dance", "house"]],
  ["b2", ["house", "dance", "french", "electronic"]],
  ["x", ["country", "folk"]],
].map(([n, tags]) => ({ track: t(n as string, tags as string[]), matchA: 0, matchB: 0 }));

describe("planJourney", () => {
  const path = planJourney(start, end, pool, { steps: 5 });
  it("returns the requested number of unique steps", () => {
    expect(path).toHaveLength(5);
    expect(new Set(path.map((s) => s.track.id)).size).toBe(5);
  });
  it("progress increases monotonically", () => {
    for (let i = 1; i < path.length; i++) expect(path[i].progress).toBeGreaterThan(path[i - 1].progress);
  });
  it("drifts away from A and toward B", () => {
    const first = driftToward(path[0].track, start, end);
    const last = driftToward(path[path.length - 1].track, start, end);
    expect(first.a).toBeGreaterThan(last.a);
    expect(last.b).toBeGreaterThan(first.b);
  });
  it("skips irrelevant tracks and respects one-per-artist", () => {
    expect(path.map((s) => s.track.id)).not.toContain("x");
  });
  it("returns fewer steps instead of looping when the pool is small", () => {
    expect(planJourney(start, end, pool.slice(0, 2), { steps: 6 }).length).toBeLessThanOrEqual(2);
  });
});

describe("planJourney with a genre route", () => {
  it("uses intermediate-genre songs that share no tags with either end", () => {
    const a = t("A", ["metal", "thrash metal"]);
    const b = t("B", ["downtempo", "chillout"]);
    const mk = (n: string, tags: string[]): JourneyCandidate => ({ track: t(n, tags), matchA: 0, matchB: 0 });
    const pool = [mk("m1", ["metal", "heavy metal"]), mk("r1", ["rock", "hard rock"]), mk("i1", ["indie", "alternative"]), mk("e1", ["electronic", "ambient"]), mk("d1", ["downtempo", "chillout"])];
    const route = ["metal", "rock", "indie", "electronic", "downtempo"];
    const path = planJourney(a, b, pool, { steps: 5, genrePath: route });
    expect(path.map((s) => s.track.id)).toEqual(["m1", "r1", "i1", "e1", "d1"]);
  });
});
