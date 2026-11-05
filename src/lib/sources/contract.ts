import type { SearchHit, TrackRef } from "../types";

export interface LfmTrackInfo extends TrackRef {
  album?: string;
  listeners?: number;
  tags: string[];
  url?: string;
}

export interface LfmSimilarTrack extends TrackRef {
  match: number;
  listeners?: number;
}

export interface LastfmSource {
  trackInfo(ref: TrackRef): Promise<LfmTrackInfo | null>;
  similarTracks(ref: TrackRef, limit: number): Promise<LfmSimilarTrack[]>;
  similarArtists(artist: string, limit: number): Promise<Array<{ name: string; match: number }>>;
  artistTopTracks(artist: string, limit: number): Promise<TrackRef[]>;
  artistTopTags(artist: string): Promise<string[]>;
  tagTopTracks(tag: string, limit: number): Promise<TrackRef[]>;
  searchTracks(query: string, limit: number): Promise<SearchHit[]>;
}

export interface DeezerMatch {
  id: number;
  artist: string;
  title: string;
  album?: string;
  artwork?: string;
  hasPreview: boolean;
  /** Only set by sources that know it without a second call (mock). */
  year?: number;
}

export interface DeezerDetails {
  id: number;
  year?: number;
  previewUrl?: string;
  artwork?: string;
  album?: string;
}

export interface DeezerSource {
  search(query: string, limit: number): Promise<SearchHit[]>;
  match(ref: TrackRef): Promise<DeezerMatch | null>;
  details(id: number): Promise<DeezerDetails | null>;
}
