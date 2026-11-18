"use client";
import { useSyncExternalStore } from "react";

/**
 * The backdrop shows the artwork of the song that is playing (if any), otherwise the
 * artwork of the page's main song. Whenever the effective image changes we remember the
 * previous one so the UI can crossfade.
 */
interface Snap {
  current?: string;
  previous?: string;
}
let pageArt: string | undefined;
let playerArt: string | undefined;
const EMPTY_SNAP: Snap = {};
let snap: Snap = EMPTY_SNAP;
const listeners = new Set<() => void>();

function recompute() {
  const next = playerArt ?? pageArt;
  if (next === snap.current) return;
  snap = { current: next, previous: snap.current };
  listeners.forEach((l) => l());
}

export function setBackdropArt(url?: string) {
  pageArt = url;
  recompute();
}

export function setPlayerArt(url?: string) {
  playerArt = url;
  recompute();
}

export function useBackdrop(): Snap {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => snap,
    () => EMPTY_SNAP,
  );
}
