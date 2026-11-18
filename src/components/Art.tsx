"use client";
import { useState } from "react";
import { useHydration } from "@/lib/client/hydration";
import { fold } from "@/lib/music/normalize";

function gradientFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const a = h % 360;
  return `linear-gradient(135deg, hsl(${a} 60% 42%), hsl(${(a + 50) % 360} 65% 24%))`;
}

interface Props {
  track: { artist: string; title: string; artwork?: string };
  className?: string;
  children?: React.ReactNode;
}

/** Square artwork that lazily hydrates from Deezer and fades in once loaded. */
export function Art({ track, className = "", children }: Props) {
  const h = useHydration(track);
  const src = track.artwork ?? h?.artwork;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const ready = src && loadedSrc === src;
  return (
    <div className={`art ${className}`} style={{ background: gradientFor(fold(track.artist + track.title)) }}>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" className={ready ? "is-ready" : ""} onLoad={() => setLoadedSrc(src)} />
      )}
      {children}
    </div>
  );
}
