import { describe, expect, it } from "vitest";
import { cleanArtist, cleanTitle, fold, sameTrack, trackId } from "./normalize";

describe("normalize", () => {
  it("strips remaster / live / feat noise from titles", () => {
    expect(cleanTitle("Creep (Remastered 2009)")).toBe("Creep");
    expect(cleanTitle("Hey Jude - Remastered 2015")).toBe("Hey Jude");
    expect(cleanTitle("Get Lucky (feat. Pharrell Williams)")).toBe("Get Lucky");
    expect(cleanTitle("Song [Live at Wembley]")).toBe("Song");
    expect(cleanTitle("Heroes")).toBe("Heroes");
  });
  it("keeps titles that are only noise-like", () => {
    expect(cleanTitle("(Live)")).toBe("(Live)");
  });
  it("drops featured artists", () => {
    expect(cleanArtist("Daft Punk feat. Pharrell")).toBe("Daft Punk");
    expect(cleanArtist("Simon & Garfunkel")).toBe("Simon & Garfunkel");
  });
  it("folds diacritics and punctuation", () => {
    expect(fold("Beyoncé – Halo!")).toBe("beyonce halo");
    expect(fold("Guns N' Roses")).toBe("guns n roses");
  });
  it("treats re-releases as the same track", () => {
    expect(sameTrack({ artist: "Radiohead", title: "Creep" }, { artist: "radiohead", title: "Creep (Remastered)" })).toBe(true);
    expect(trackId({ artist: "A", title: "B" })).toBe("a::b");
  });
});
