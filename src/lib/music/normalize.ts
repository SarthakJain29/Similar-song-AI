import type { TrackRef } from "../types";

/** Strip diacritics, punctuation and case for comparison. */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9Ѐ-ӿ぀-ヿ一-鿿가-힯 ]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE_PAREN =
  /\s*[([](?:[^)\]]*\b(?:remaster(?:ed)?|remix|live|mono|stereo|version|edit|mix|deluxe|bonus|single|album|radio|acoustic|demo|feat\.?|ft\.?|featuring|explicit|clean|from)\b[^)\]]*)[)\]]/gi;
const NOISE_DASH =
  /\s+[-–—]\s+(?:\d{4}\s+)?(?:remaster(?:ed)?(?:\s+\d{4})?|remix|live.*|mono|stereo|single version|radio edit|album version|\d{4} version|bonus track|acoustic.*)\s*$/i;

/** "Creep (Remastered 2009)" -> "Creep". Used for Last.fm lookups and de-duplication. */
export function cleanTitle(title: string): string {
  let t = title;
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(NOISE_PAREN, "").replace(NOISE_DASH, "");
  }
  return t.trim() || title.trim();
}

/** Primary artist only: "A feat. B", "A & B" stays (many acts contain &), but feat/ft/with are dropped. */
export function cleanArtist(artist: string): string {
  return artist.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.*$/i, "").trim() || artist.trim();
}

export function trackId(ref: TrackRef): string {
  return `${fold(cleanArtist(ref.artist))}::${fold(cleanTitle(ref.title))}`;
}

export function sameTrack(a: TrackRef, b: TrackRef): boolean {
  return trackId(a) === trackId(b);
}

/** Dedupe key for "same song, different edit" detection. */
export function songKey(ref: TrackRef): string {
  return trackId(ref);
}
