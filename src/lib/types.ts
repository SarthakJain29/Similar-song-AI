/** Shared domain types (server + client). */

export interface TrackRef {
  artist: string;
  title: string;
}

export interface Track extends TrackRef {
  /** Stable key: normalised "artist::title". */
  id: string;
  album?: string;
  /** Square artwork URL (already routed through our image proxy where needed). */
  artwork?: string;
  deezerId?: number;
  /** 30s preview is resolved lazily (URLs expire in ~15 min). */
  hasPreview?: boolean;
  /** Four-digit release year when known. */
  year?: number;
  /** Last.fm listeners (unique). */
  listeners?: number;
  /** Cleaned, ordered most-relevant first. */
  tags: string[];
  lastfmUrl?: string;
}

export interface Recommendation {
  track: Track;
  /** Final blended score 0..1 used for ordering. */
  score: number;
  /** Raw Last.fm similarity 0..1 (relative to the seed). */
  match: number;
  sharedTags: string[];
  /** 0..1 where 1 = very popular. */
  popularity: number;
}

export interface VibeSettings {
  /** -1 more obscure .. +1 more popular. */
  popularity: number;
  /** -1 older .. +1 newer. */
  era: number;
  /** -1 calm .. +1 intense. */
  energy: number;
  /** Selected mood ids, see MOODS. */
  moods: string[];
}

export const DEFAULT_VIBE: VibeSettings = { popularity: 0, era: 0, energy: 0, moods: [] };

export interface SimilarResponse {
  seed: Track;
  results: Recommendation[];
  /** Other songs by the seed's artist, kept out of the main list to preserve diversity. */
  moreFromArtist: Recommendation[];
  mock: boolean;
}

export interface JourneyStep {
  track: Track;
  /** 0 (at A) .. 1 (at B). */
  progress: number;
  sharedWithPrev: string[];
  sharedWithEnd: string[];
}

export interface JourneyResponse {
  start: Track;
  end: Track;
  steps: JourneyStep[];
  mock: boolean;
}

export interface SearchHit extends TrackRef {
  id: string;
  album?: string;
  artwork?: string;
  deezerId?: number;
}

export interface Explanation {
  id: string;
  text: string;
  /** Tags/facts the explanation is grounded in. */
  evidence: string[];
  source: "llm" | "template";
}

export interface SavedPlaylist {
  id: string;
  name: string;
  kind: "similar" | "journey" | "custom";
  createdAt: number;
  tracks: PlaylistTrack[];
}

export interface PlaylistTrack extends TrackRef {
  id: string;
  album?: string;
  artwork?: string;
  deezerId?: number;
}
