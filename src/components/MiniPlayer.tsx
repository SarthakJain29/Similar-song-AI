"use client";
import { useHydration } from "@/lib/client/hydration";
import { usePlayer } from "@/hooks/player";
import { Art } from "./Art";
import { Icon } from "./Logo";

export function MiniPlayer() {
  const p = usePlayer();
  const h = useHydration(p.current);
  if (!p.current) return null;
  const art = p.current.artwork ?? h?.artwork;
  return (
    <div className="miniplayer glass glass--strong" role="region" aria-label="Preview player">
      <Art track={{ ...p.current, artwork: art }} className="art--mini" />
      <div className="miniplayer__meta">
        <strong>{p.current.title}</strong>
        <span>{p.status === "error" ? p.message : p.status === "loading" ? "Loading preview…" : `${p.current.artist} · 30s preview`}</span>
      </div>
      <div className="miniplayer__ctrl">
        <button className="icon-btn" onClick={p.prev} aria-label="Previous">
          <Icon name="prev" />
        </button>
        <button className="icon-btn icon-btn--lg" onClick={() => p.toggle()} aria-label={p.status === "playing" ? "Pause" : "Play"}>
          {p.status === "loading" ? <span className="spinner spinner--sm" /> : <Icon name={p.status === "playing" ? "pause" : "play"} size={24} />}
        </button>
        <button className="icon-btn" onClick={p.next} aria-label="Next">
          <Icon name="next" />
        </button>
      </div>
      <input className="miniplayer__seek" type="range" min={0} max={1000} value={Math.round(p.progress * 1000)} onChange={(e) => p.seek(Number(e.target.value) / 1000)} aria-label="Seek" style={{ ["--pct" as string]: `${p.progress * 100}%` }} />
      <button className="icon-btn icon-btn--sm miniplayer__close" onClick={p.stop} aria-label="Close player">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
