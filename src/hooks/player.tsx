"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiPreviewUrl } from "@/lib/client/api";
import type { PlaylistTrack } from "@/lib/types";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayerApi {
  current: PlaylistTrack | null;
  status: Status;
  /** 0..1 position within the 30s preview */
  progress: number;
  message: string | null;
  play: (track: PlaylistTrack, queue?: PlaylistTrack[]) => void;
  toggle: (track?: PlaylistTrack, queue?: PlaylistTrack[]) => void;
  next: () => void;
  prev: () => void;
  seek: (fraction: number) => void;
  stop: () => void;
}

const Ctx = createContext<PlayerApi | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlaylistTrack[]>([]);
  const tokenRef = useRef(0);
  const [current, setCurrent] = useState<PlaylistTrack | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const playRef = useRef<(t: PlaylistTrack, q?: PlaylistTrack[], dir?: 1 | -1) => void>(() => {});

  const step = useCallback((dir: 1 | -1, from?: PlaylistTrack | null) => {
    const q = queueRef.current;
    const idx = q.findIndex((t) => t.id === from?.id);
    const nextTrack = idx >= 0 ? q[idx + dir] : undefined;
    if (nextTrack) playRef.current(nextTrack, undefined, dir);
    else if (dir === 1) {
      setStatus("idle");
      setProgress(0);
    }
  }, []);

  const play = useCallback(
    (track: PlaylistTrack, queue?: PlaylistTrack[], dir: 1 | -1 = 1) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (queue) queueRef.current = queue;
      const token = ++tokenRef.current;
      audio.pause();
      setCurrent(track);
      setStatus("loading");
      setProgress(0);
      setMessage(null);
      apiPreviewUrl(track)
        .then(async (url) => {
          if (token !== tokenRef.current) return;
          if (!url) throw new Error("No preview available for this song");
          audio.src = url;
          await audio.play();
        })
        .catch((e: unknown) => {
          if (token !== tokenRef.current) return;
          const msg = e instanceof Error ? e.message : "Couldn't play preview";
          const autoplayBlocked = e instanceof DOMException && e.name === "NotAllowedError";
          setStatus(autoplayBlocked ? "paused" : "error");
          setMessage(autoplayBlocked ? "Tap play to start" : msg);
          // skip unplayable tracks when playing through a queue
          if (!autoplayBlocked && queueRef.current.length > 1) setTimeout(() => token === tokenRef.current && step(dir, track), 900);
        });
    },
    [step],
  );

  useEffect(() => {
    playRef.current = play;
  }, [play]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onPlay = () => setStatus("playing");
    const onPause = () => !audio.ended && setStatus((s) => (s === "playing" ? "paused" : s));
    const onEnd = () => {
      setProgress(1);
      setCurrent((c) => {
        queueMicrotask(() => step(1, c));
        return c;
      });
    };
    const onErr = () => {
      setStatus("error");
      setMessage("Couldn't load this preview");
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("playing", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("error", onErr);
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onErr);
    };
  }, [step]);

  const toggle = useCallback(
    (track?: PlaylistTrack, queue?: PlaylistTrack[]) => {
      const audio = audioRef.current;
      if (track && track.id !== current?.id) return play(track, queue);
      if (!audio || !current) return;
      if (status === "playing") audio.pause();
      else if (status === "paused" && audio.src) audio.play().catch(() => {});
      else play(current);
    },
    [current, status, play],
  );

  const api = useMemo<PlayerApi>(
    () => ({
      current,
      status,
      progress,
      message,
      play,
      toggle,
      next: () => step(1, current),
      prev: () => {
        const audio = audioRef.current;
        if (audio && audio.currentTime > 3) {
          audio.currentTime = 0;
          return;
        }
        step(-1, current);
      },
      seek: (f) => {
        const a = audioRef.current;
        if (a?.duration) a.currentTime = Math.max(0, Math.min(1, f)) * a.duration;
      },
      stop: () => {
        tokenRef.current++;
        audioRef.current?.pause();
        setCurrent(null);
        setStatus("idle");
        setProgress(0);
      },
    }),
    [current, status, progress, message, play, toggle, step],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used inside PlayerProvider");
  return v;
}
