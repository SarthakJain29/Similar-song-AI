import { describe, expect, it } from "vitest";
import { popularityScore, rankCandidates, type Candidate } from "./scoring";
import { DEFAULT_VIBE, type Track } from "../types";

const t = (artist: string, title: string, tags: string[], extra: Partial<Track> = {}): Track => ({ id: `${artist}::${title}`.toLowerCase(), artist, title, tags, ...extra });
const seed = t("Seed", "Song", ["indie rock", "alternative", "melancholy"], { listeners: 1_000_000, year: 2000 });

const pool: Candidate[] = [
  { track: t("Big", "Hit", ["indie rock", "alternative"], { listeners: 5_000_000, year: 2018 }), match: 0.6 },
  { track: t("Deep", "Cut", ["indie rock", "alternative"], { listeners: 8_000, year: 1985 }), match: 0.6 },
  { track: t("Calm", "Piece", ["indie rock", "alternative", "ambient", "chillout"], { listeners: 500_000, year: 2010 }), match: 0.6 },
  { track: t("Loud", "Noise", ["indie rock", "alternative", "punk", "hardcore"], { listeners: 500_000, year: 2010 }), match: 0.6 },
  { track: t("Sad", "Tune", ["indie rock", "sad", "melancholy"], { listeners: 500_000, year: 2010 }), match: 0.6 },
];
const names = (v: Partial<typeof DEFAULT_VIBE>) => rankCandidates(seed, pool, { ...DEFAULT_VIBE, ...v }).map((r) => r.track.artist);

describe("scoring", () => {
  it("maps listeners to 0..1 on a log scale", () => {
    expect(popularityScore(500)).toBe(0);
    expect(popularityScore(10_000_000)).toBe(1);
    expect(popularityScore(100_000)).toBeLessThan(popularityScore(1_000_000));
  });
  it("popularity slider flips the order of hit vs deep cut", () => {
    const pop = names({ popularity: 1 });
    const obs = names({ popularity: -1 });
    expect(pop.indexOf("Big")).toBeLessThan(pop.indexOf("Deep"));
    expect(obs.indexOf("Deep")).toBeLessThan(obs.indexOf("Big"));
  });
  it("era slider prefers newer / older", () => {
    const newer = names({ era: 1 });
    const older = names({ era: -1 });
    expect(newer.indexOf("Big")).toBeLessThan(newer.indexOf("Deep"));
    expect(older.indexOf("Deep")).toBeLessThan(older.indexOf("Big"));
  });
  it("energy slider prefers calm / intense", () => {
    expect(names({ energy: -1 })[0]).toBe("Calm");
    expect(names({ energy: 1 })[0]).toBe("Loud");
  });
  it("mood chips lift matching tracks", () => {
    expect(names({ moods: ["melancholy"] })[0]).toBe("Sad");
    expect(names({ moods: ["chill"] })[0]).toBe("Calm");
  });
  it("drops the seed and duplicate editions, caps tracks per artist", () => {
    const dupes: Candidate[] = [
      { track: t("Seed", "Song (Remastered)", ["indie rock"]), match: 1 },
      { track: t("A", "One", ["indie rock"]), match: 0.9 },
      { track: t("A", "One (Live)", ["indie rock"]), match: 0.9 },
      { track: t("A", "Two", ["indie rock"]), match: 0.8 },
      { track: t("A", "Three", ["indie rock"]), match: 0.7 },
    ];
    const out = rankCandidates(seed, dupes, DEFAULT_VIBE, { maxPerArtist: 2 });
    expect(out.map((r) => r.track.title)).toEqual(["One", "Two"]);
  });
  it("limits the seed's own artist to seedArtistCap", () => {
    const same: Candidate[] = [1, 2, 3].map((i) => ({ track: t("Seed", `Other ${i}`, ["indie rock"]), match: 0.9 }));
    const out = rankCandidates(seed, [...same, ...pool], DEFAULT_VIBE, { seedArtistCap: 1 });
    expect(out.filter((r) => r.track.artist === "Seed")).toHaveLength(1);
  });
  it("neutral vibe is a pure similarity ranking", () => {
    const out = rankCandidates(seed, pool, DEFAULT_VIBE);
    expect(out.length).toBe(5);
    for (let i = 1; i < out.length; i++) expect(out[i - 1].score).toBeGreaterThanOrEqual(out[i].score);
  });
});
