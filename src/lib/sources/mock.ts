/**
 * Offline mock data so the whole app (search → similar → explain → journey) runs
 * without any API keys. A tiny hand-written catalogue; "similar" is derived from tag overlap.
 */
import { trackId } from "../music/normalize";
import { tagSimilarity } from "../music/tags";
import type { SearchHit, TrackRef } from "../types";
import type { DeezerSource, LastfmSource, LfmSimilarTrack, LfmTrackInfo } from "./contract";

interface MockTrack {
  artist: string;
  title: string;
  album: string;
  year: number;
  listeners: number;
  tags: string[];
}

const T = (artist: string, title: string, album: string, year: number, listeners: number, tags: string): MockTrack => ({
  artist,
  title,
  album,
  year,
  listeners,
  tags: tags.split(",").map((s) => s.trim()),
});

export const MOCK_CATALOG: MockTrack[] = [
  T("Radiohead", "Creep", "Pablo Honey", 1992, 4200000, "alternative rock, grunge, melancholy, 90s, rock"),
  T("Radiohead", "No Surprises", "OK Computer", 1997, 3500000, "alternative rock, melancholy, dream pop, 90s, mellow"),
  T("Radiohead", "Karma Police", "OK Computer", 1997, 4000000, "alternative rock, art rock, melancholy, 90s, rock"),
  T("Nirvana", "Smells Like Teen Spirit", "Nevermind", 1991, 5200000, "grunge, alternative rock, rock, 90s, aggressive"),
  T("Nirvana", "Something in the Way", "Nevermind", 1991, 2100000, "grunge, melancholy, alternative rock, dark, acoustic"),
  T("Pixies", "Where Is My Mind?", "Surfer Rosa", 1988, 2600000, "alternative rock, indie rock, 80s, noise pop, rock"),
  T("The Smiths", "There Is a Light That Never Goes Out", "The Queen Is Dead", 1986, 1900000, "indie pop, 80s, melancholy, jangle pop, romantic"),
  T("Joy Division", "Love Will Tear Us Apart", "Substance", 1980, 2400000, "post-punk, new wave, 80s, melancholy, dark"),
  T("The Cure", "Lovesong", "Disintegration", 1989, 1700000, "gothic rock, new wave, romantic, 80s, dreamy"),
  T("Cocteau Twins", "Heaven or Las Vegas", "Heaven or Las Vegas", 1990, 600000, "dream pop, shoegaze, ethereal, dreamy, 90s"),
  T("My Bloody Valentine", "Only Shallow", "Loveless", 1991, 800000, "shoegaze, noise pop, dreamy, alternative rock, 90s"),
  T("Slowdive", "When the Sun Hits", "Souvlaki", 1993, 500000, "shoegaze, dream pop, dreamy, atmospheric, 90s"),
  T("Beach House", "Space Song", "Depression Cherry", 2015, 1200000, "dream pop, chillwave, dreamy, mellow, indie"),
  T("Mazzy Star", "Fade Into You", "So Tonight That I Might See", 1993, 1700000, "dream pop, slowcore, melancholy, romantic, 90s"),
  T("Lana Del Rey", "Video Games", "Born to Die", 2011, 3800000, "baroque pop, melancholy, romantic, sad, indie pop"),
  T("Cigarettes After Sex", "Apocalypse", "Cigarettes After Sex", 2017, 1900000, "dream pop, ambient pop, romantic, dreamy, mellow"),
  T("Daft Punk", "Get Lucky", "Random Access Memories", 2013, 3900000, "disco, funk, electronic, dance, happy"),
  T("Daft Punk", "One More Time", "Discovery", 2000, 4100000, "house, electronic, dance, french house, happy"),
  T("Justice", "D.A.N.C.E.", "†", 2007, 1400000, "electro, french house, electronic, dance, party"),
  T("Chromeo", "Fancy Footwork", "Fancy Footwork", 2007, 700000, "electro funk, funk, dance, electronic, party"),
  T("Kavinsky", "Nightcall", "OutRun", 2010, 2500000, "synthwave, electronic, dark, retrowave, 80s"),
  T("The Weeknd", "Blinding Lights", "After Hours", 2019, 3600000, "synthpop, pop, 80s, dance, upbeat"),
  T("Dua Lipa", "Levitating", "Future Nostalgia", 2020, 3000000, "pop, disco, dance, happy, upbeat"),
  T("Tame Impala", "The Less I Know the Better", "Currents", 2015, 3300000, "psychedelic, indie, dream pop, funk, dreamy"),
  T("Mac DeMarco", "Chamber of Reflection", "Salad Days", 2014, 1500000, "slacker rock, indie, psychedelic, chill, mellow"),
  T("Khruangbin", "Time (You and I)", "Mordechai", 2020, 700000, "psychedelic funk, funk, chill, instrumental, groove"),
  T("Bon Iver", "Skinny Love", "For Emma, Forever Ago", 2007, 3400000, "indie folk, folk, melancholy, acoustic, sad"),
  T("Iron & Wine", "Naked As We Came", "Our Endless Numbered Days", 2004, 1200000, "indie folk, folk, acoustic, mellow, melancholy"),
  T("Nick Drake", "Pink Moon", "Pink Moon", 1972, 1000000, "folk, acoustic, melancholy, 70s, singer-songwriter"),
  T("Fleet Foxes", "White Winter Hymnal", "Fleet Foxes", 2008, 1700000, "indie folk, folk, chamber pop, acoustic, dreamy"),
  T("Massive Attack", "Teardrop", "Mezzanine", 1998, 2700000, "trip-hop, downtempo, electronic, dark, atmospheric"),
  T("Portishead", "Glory Box", "Dummy", 1994, 2200000, "trip-hop, downtempo, dark, romantic, 90s"),
  T("Bonobo", "Kerala", "Migration", 2017, 800000, "downtempo, electronic, chillout, ambient, chill"),
  T("Boards of Canada", "Roygbiv", "Music Has the Right to Children", 1998, 900000, "idm, ambient, electronic, downtempo, dreamy"),
  T("Aphex Twin", "Xtal", "Selected Ambient Works 85–92", 1992, 1300000, "ambient, idm, electronic, dreamy, chill"),
  T("Brian Eno", "An Ending (Ascent)", "Apollo", 1983, 1100000, "ambient, instrumental, atmospheric, calm, 80s"),
  T("Metallica", "Master of Puppets", "Master of Puppets", 1986, 3400000, "thrash metal, metal, heavy metal, aggressive, 80s"),
  T("Black Sabbath", "Paranoid", "Paranoid", 1970, 3300000, "heavy metal, hard rock, metal, 70s, dark"),
  T("Rage Against the Machine", "Killing in the Name", "Rage Against the Machine", 1992, 3300000, "rap metal, alternative metal, aggressive, rock, 90s"),
  T("Arctic Monkeys", "Do I Wanna Know?", "AM", 2013, 3900000, "indie rock, garage rock, rock, dark, alternative"),
  T("The Strokes", "Reptilia", "Room on Fire", 2003, 2800000, "garage rock, indie rock, rock, 00s, alternative"),
  T("Fleetwood Mac", "Dreams", "Rumours", 1977, 3600000, "classic rock, soft rock, 70s, romantic, mellow"),
  T("Stevie Wonder", "Superstition", "Talking Book", 1972, 3000000, "funk, soul, 70s, groove, dance"),
  T("Amy Winehouse", "Back to Black", "Back to Black", 2006, 3900000, "soul, retro soul, melancholy, jazz, 00s"),
  T("Kendrick Lamar", "Money Trees", "good kid, m.A.A.d city", 2012, 3000000, "hip-hop, rap, west coast, chill, dark"),
  T("Frank Ocean", "Pink + White", "Blonde", 2016, 2100000, "r&b, alternative r&b, chill, mellow, romantic"),
  T("Kali Uchis", "Telepatía", "Sin Miedo", 2020, 900000, "dream pop, latin pop, chill, romantic, r&b"),
];

const find = (ref: TrackRef) => {
  const id = trackId(ref);
  return MOCK_CATALOG.find((t) => trackId(t) === id);
};

/** Deterministic gradient cover so mock mode still looks good. */
export function mockArtwork(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const h1 = h % 360;
  const h2 = (h1 + 40 + (h % 80)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 75% 55%)"/><stop offset="1" stop-color="hsl(${h2} 80% 30%)"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="${120 + (h % 160)}" cy="${120 + ((h >> 3) % 160)}" r="${90 + (h % 60)}" fill="hsl(${h2} 90% 70%)" opacity=".35"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const mockMeta = (ref: TrackRef) => find(ref);

export const mockLastfm: LastfmSource = {
  async trackInfo(ref) {
    const t = find(ref);
    if (!t) return null;
    const info: LfmTrackInfo = { artist: t.artist, title: t.title, album: t.album, listeners: t.listeners, tags: t.tags };
    return info;
  },
  async similarTracks(ref, limit) {
    const seed = find(ref);
    if (!seed) return [];
    const out: LfmSimilarTrack[] = MOCK_CATALOG.filter((t) => t !== seed)
      .map((t) => ({ artist: t.artist, title: t.title, match: Math.min(1, tagSimilarity(seed.tags, t.tags) * 1.15 + (t.artist === seed.artist ? 0.1 : 0)) }))
      .filter((t) => t.match > 0.05)
      .sort((a, b) => b.match - a.match)
      .slice(0, limit);
    return out;
  },
  async similarArtists() {
    return [];
  },
  async artistTopTracks(artist, limit) {
    return MOCK_CATALOG.filter((t) => t.artist === artist).slice(0, limit);
  },
  async artistTopTags(artist) {
    return MOCK_CATALOG.find((t) => t.artist === artist)?.tags ?? [];
  },
  async searchTracks(q, limit) {
    return mockSearch(q, limit);
  },
};

export function mockSearch(q: string, limit: number): SearchHit[] {
  const needle = q.toLowerCase();
  return MOCK_CATALOG.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(needle))
    .slice(0, limit)
    .map((t) => ({ id: trackId(t), artist: t.artist, title: t.title, album: t.album, artwork: mockArtwork(t.album + t.artist) }));
}

export const mockDeezer: DeezerSource = {
  async search(q, limit) {
    return mockSearch(q, limit);
  },
  async match(ref) {
    const t = find(ref);
    if (!t) return null;
    return { id: 0, artist: t.artist, title: t.title, album: t.album, artwork: mockArtwork(t.album + t.artist), hasPreview: false, year: t.year };
  },
  async details() {
    return null;
  },
};
