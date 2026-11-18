import { config } from "../config";
import type { DeezerSource, LastfmSource } from "./contract";
import { deezer } from "./deezer";
import { lastfm } from "./lastfm";
import { mockDeezer, mockLastfm } from "./mock";

/** Resolved per call so MOCK_MODE / key changes apply without a restart in tests. */
export const sources = {
  get lastfm(): LastfmSource {
    return config.mock ? mockLastfm : lastfm;
  },
  get deezer(): DeezerSource {
    return config.mock ? mockDeezer : deezer;
  },
};

export type { DeezerSource, LastfmSource } from "./contract";
