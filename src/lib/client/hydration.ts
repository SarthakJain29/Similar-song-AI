"use client";
/**
 * Client-side store for lazily fetched Deezer data (artwork, year, preview availability).
 * Rows ask for hydration when they mount; requests are de-duplicated and throttled to 4 in flight.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Hydration } from "../catalog";
import { trackId } from "../music/normalize";
import type { TrackRef } from "../types";
import { apiEnrich } from "./api";

const store = new Map<string, Hydration>();
const requested = new Set<string>();
const listeners = new Set<() => void>();
const queue: Array<() => Promise<void>> = [];
let active = 0;

function emit() {
  listeners.forEach((l) => l());
}

function pump() {
  while (active < 4 && queue.length) {
    const job = queue.shift()!;
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

export function requestHydration(ref: TrackRef) {
  const id = trackId(ref);
  if (requested.has(id)) return;
  requested.add(id);
  queue.push(async () => {
    try {
      store.set(id, await apiEnrich(ref));
    } catch {
      requested.delete(id); // allow a retry later
      return;
    }
    emit();
  });
  pump();
}

/** Seed the store with data we already have (e.g. artwork from search hits). */
export function primeHydration(h: Hydration) {
  const cur = store.get(h.id);
  if (cur?.artwork && !h.artwork) return;
  store.set(h.id, { ...cur, ...h });
  requested.add(h.id);
  emit();
}

export function useHydration(ref: (TrackRef & { artwork?: string; year?: number }) | null | undefined): Hydration | undefined {
  const id = ref ? trackId(ref) : "";
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  }, []);
  const snap = useSyncExternalStore(
    subscribe,
    () => store.get(id),
    () => undefined,
  );
  const artist = ref?.artist;
  const title = ref?.title;
  const hasArt = Boolean(ref?.artwork);
  useEffect(() => {
    if (artist && title && !hasArt) requestHydration({ artist, title });
  }, [artist, title, hasArt]);
  return snap;
}

export function hydratedArtwork(ref: TrackRef & { artwork?: string }): string | undefined {
  return ref.artwork ?? store.get(trackId(ref))?.artwork;
}
