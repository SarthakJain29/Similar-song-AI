import { describe, expect, it } from "vitest";
import { originalYear } from "./deezer";

describe("originalYear", () => {
  it("prefers the earlier of release date and ISRC year (reissues)", () => {
    expect(originalYear("2018-05-01", "USGF19400250")).toBe(1994);
    expect(originalYear("1993-02-15", "GBAYE9200070")).toBe(1992);
  });
  it("falls back gracefully", () => {
    expect(originalYear("2001-03-01", undefined)).toBe(2001);
    expect(originalYear(undefined, undefined)).toBeUndefined();
    expect(originalYear("2001-03-01", "garbage")).toBe(2001);
  });
  it("ignores ISRC years later than the release", () => {
    expect(originalYear("2010-01-01", "USAB11500001")).toBe(2010);
  });
});
