"use client";
import { useHydration } from "@/lib/client/hydration";
import { toPlaylistTrack } from "@/lib/client/library";
import { displayTitle } from "@/lib/music/normalize";
import type { PlaylistTrack, Recommendation } from "@/lib/types";
import { Art } from "./Art";
import { Icon } from "./Logo";
import { PlayOverlay } from "./TrackRow";

function Card({ rec, queue, inDraft, onToggle }: { rec: Recommendation; queue: PlaylistTrack[]; inDraft: boolean; onToggle: (t: PlaylistTrack) => void }) {
  const h = useHydration(rec.track);
  const pt = toPlaylistTrack({ ...rec.track, artwork: rec.track.artwork ?? h?.artwork, deezerId: rec.track.deezerId ?? h?.deezerId });
  return (
    <li className="mini-card">
      <Art track={{ ...rec.track, artwork: pt.artwork }} className="art--card">
        <PlayOverlay track={pt} queue={queue} />
      </Art>
      <strong>{displayTitle(rec.track.title)}</strong>
      <button className={`icon-btn icon-btn--sm mini-card__add ${inDraft ? "is-on" : ""}`} onClick={() => onToggle(pt)} aria-pressed={inDraft} aria-label={inDraft ? `Remove ${rec.track.title} from my picks` : `Add ${rec.track.title} to my picks`}>
        <Icon name={inDraft ? "check" : "plus"} size={16} />
      </button>
    </li>
  );
}

/** Horizontal row of other songs by the seed artist, kept out of the main list for diversity. */
export function MoreFromArtist({ artist, items, inDraft, onToggle }: { artist: string; items: Recommendation[]; inDraft: Set<string>; onToggle: (t: PlaylistTrack) => void }) {
  if (!items.length) return null;
  const queue = items.map((r) => toPlaylistTrack(r.track));
  return (
    <section className="more" aria-label={`More from ${artist}`}>
      <h2>More from {artist}</h2>
      <ul className="more__row">
        {items.map((r) => (
          <Card key={r.track.id} rec={r} queue={queue} inDraft={inDraft.has(r.track.id)} onToggle={onToggle} />
        ))}
      </ul>
    </section>
  );
}
