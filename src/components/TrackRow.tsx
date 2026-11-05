"use client";
import { displayTitle } from "@/lib/music/normalize";
import { useHydration } from "@/lib/client/hydration";
import { toPlaylistTrack } from "@/lib/client/library";
import type { Explanation, PlaylistTrack, Track } from "@/lib/types";
import { usePlayer } from "@/hooks/player";
import { Art } from "./Art";
import { Icon } from "./Logo";

export function PlayOverlay({ track, queue }: { track: PlaylistTrack; queue?: PlaylistTrack[] }) {
  const player = usePlayer();
  const isCurrent = player.current?.id === track.id;
  const playing = isCurrent && player.status === "playing";
  const loading = isCurrent && player.status === "loading";
  return (
    <button className={`play-overlay ${isCurrent ? "is-current" : ""}`} onClick={() => player.toggle(track, queue)} aria-label={`${playing ? "Pause" : "Play preview of"} ${track.title} by ${track.artist}`}>
      {loading ? <span className="spinner spinner--sm" /> : <Icon name={playing ? "pause" : "play"} size={22} />}
      {isCurrent && player.status !== "idle" && player.status !== "error" && (
        <svg className="play-overlay__ring" viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="16" pathLength="100" strokeDasharray={`${Math.round(player.progress * 100)} 100`} />
        </svg>
      )}
    </button>
  );
}

function MatchRing({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="match" title={`Last.fm similarity: ${pct}%`} aria-label={`${pct}% match`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="15" className="match__bg" />
        <circle cx="18" cy="18" r="15" className="match__fg" pathLength="100" strokeDasharray={`${pct} 100`} />
      </svg>
      <span>{pct}</span>
    </div>
  );
}

function Why({ explanation, tags, loading }: { explanation?: Explanation; tags: string[]; loading: boolean }) {
  if (!explanation) {
    return loading ? (
      <div className="why why--loading" aria-label="Writing explanation">
        <span className="shimmer" />
        <span className="shimmer shimmer--short" />
      </div>
    ) : null;
  }
  const hot = new Set(explanation.evidence);
  return (
    <div className="why">
      <p>
        {explanation.source === "llm" && (
          <span className="badge" title="Written by an AI model using only this song's Last.fm tags and stats">
            <Icon name="sparkle" size={12} /> AI
          </span>
        )}
        {explanation.text}
      </p>
      {tags.length > 0 && (
        <ul className="tags" aria-label="Shared tags">
          {tags.slice(0, 5).map((t) => (
            <li key={t} className={`chip chip--sm ${hot.has(t) ? "chip--hot" : ""}`}>
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RowProps {
  track: Track;
  index: number;
  match?: number;
  sharedTags?: string[];
  explanation?: Explanation;
  explaining: boolean;
  queue: PlaylistTrack[];
  inDraft: boolean;
  onToggleDraft: (t: PlaylistTrack) => void;
  /** Optional element shown above the title (journey step label). */
  eyebrow?: React.ReactNode;
  as?: "li" | "div";
}

export function TrackRow({ track, index, match, sharedTags = [], explanation, explaining, queue, inDraft, onToggleDraft, eyebrow, as: Tag = "li" }: RowProps) {
  const h = useHydration(track);
  const merged = { ...track, artwork: track.artwork ?? h?.artwork, deezerId: track.deezerId ?? h?.deezerId };
  const year = track.year ?? h?.year;
  const pt = toPlaylistTrack(merged);
  return (
    <Tag className="row glass" style={{ ["--i" as string]: index }}>
      <Art track={merged} className="art--row">
        <PlayOverlay track={pt} queue={queue} />
      </Art>
      <div className="row__main">
        {eyebrow}
        <div className="row__title">
          <h3>{displayTitle(track.title)}</h3>
          <p>
            {track.artist}
            {year ? ` · ${year}` : ""}
          </p>
        </div>
        <Why explanation={explanation} tags={explanation ? (sharedTags.length ? sharedTags : track.tags) : []} loading={explaining} />
      </div>
      <div className="row__side">
        {match !== undefined && <MatchRing value={match} />}
        <button className={`icon-btn ${inDraft ? "is-on" : ""}`} onClick={() => onToggleDraft(pt)} aria-pressed={inDraft} aria-label={inDraft ? `Remove ${track.title} from my picks` : `Add ${track.title} to my picks`} title={inDraft ? "In your picks" : "Add to my picks"}>
          <Icon name={inDraft ? "check" : "plus"} size={20} />
        </button>
      </div>
    </Tag>
  );
}
