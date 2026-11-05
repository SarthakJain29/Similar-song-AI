"use client";
/** localStorage-backed playlists + draft ("My picks"), exposed through useSyncExternalStore. */
import { useSyncExternalStore } from "react";
import type { PlaylistTrack, SavedPlaylist } from "../types";

const PLAYLISTS_KEY = "ssai.playlists.v1";
const DRAFT_KEY = "ssai.draft.v1";

interface State {
  playlists: SavedPlaylist[];
  draft: PlaylistTrack[];
}

const EMPTY: State = { playlists: [], draft: [] };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / blocked: keep working in memory */
  }
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = { playlists: read<SavedPlaylist[]>(PLAYLISTS_KEY, []), draft: read<PlaylistTrack[]>(DRAFT_KEY, []) };
  window.addEventListener("storage", (e) => {
    if (e.key === PLAYLISTS_KEY || e.key === DRAFT_KEY) {
      state = { playlists: read(PLAYLISTS_KEY, []), draft: read(DRAFT_KEY, []) };
      emit();
    }
  });
}

function emit() {
  listeners.forEach((l) => l());
}

function set(next: Partial<State>) {
  state = { ...state, ...next };
  if (next.playlists) write(PLAYLISTS_KEY, state.playlists);
  if (next.draft) write(DRAFT_KEY, state.draft);
  emit();
}

/** Keep stored tracks lean: never persist signed preview URLs. */
export const toPlaylistTrack = (t: { id: string; artist: string; title: string; album?: string; artwork?: string; deezerId?: number }): PlaylistTrack => ({
  id: t.id,
  artist: t.artist,
  title: t.title,
  album: t.album,
  artwork: t.artwork,
  deezerId: t.deezerId,
});

export const library = {
  addToDraft(t: PlaylistTrack) {
    if (state.draft.some((d) => d.id === t.id)) return;
    set({ draft: [...state.draft, t] });
  },
  removeFromDraft(id: string) {
    set({ draft: state.draft.filter((d) => d.id !== id) });
  },
  clearDraft() {
    set({ draft: [] });
  },
  save(name: string, kind: SavedPlaylist["kind"], tracks: PlaylistTrack[]): SavedPlaylist {
    const pl: SavedPlaylist = { id: crypto.randomUUID(), name: name.trim() || "Untitled playlist", kind, createdAt: Date.now(), tracks };
    set({ playlists: [pl, ...state.playlists] });
    return pl;
  },
  remove(id: string) {
    set({ playlists: state.playlists.filter((p) => p.id !== id) });
  },
  rename(id: string, name: string) {
    set({ playlists: state.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) });
  },
};

export function useLibrary(): State {
  return useSyncExternalStore(
    (cb) => {
      load();
      listeners.add(cb);
      // first subscription loads from storage; notify so components re-read
      queueMicrotask(cb);
      return () => void listeners.delete(cb);
    },
    () => state,
    () => EMPTY,
  );
}
