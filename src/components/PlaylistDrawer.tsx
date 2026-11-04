"use client";
import { useEffect, useRef, useState } from "react";
import { library, useLibrary } from "@/lib/client/library";
import { hydratedArtwork } from "@/lib/client/hydration";
import type { PlaylistTrack, SavedPlaylist } from "@/lib/types";
import { usePlayer } from "@/hooks/player";
import { Art } from "./Art";
import { Icon } from "./Logo";
import type { ShareTarget } from "./ShareModal";

interface Props {
  open: boolean;
  onClose: () => void;
  onShare: (t: ShareTarget) => void;
}

const kindLabel: Record<SavedPlaylist["kind"], string> = { similar: "Similar songs", journey: "Journey", custom: "My picks" };

function withArt(tracks: PlaylistTrack[]): PlaylistTrack[] {
  return tracks.map((t) => ({ ...t, artwork: hydratedArtwork(t) }));
}

export function PlaylistDrawer({ open, onClose, onShare }: Props) {
  const { playlists, draft } = useLibrary();
  const player = usePlayer();
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`scrim ${open ? "is-open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer glass glass--strong ${open ? "is-open" : ""}`} aria-label="Your playlists" aria-hidden={!open} inert={!open}>
        <header className="drawer__head">
          <h2>Your library</h2>
          <button ref={closeRef} className="icon-btn" onClick={onClose} aria-label="Close library">
            <Icon name="close" />
          </button>
        </header>

        <section className="drawer__section">
          <div className="drawer__title">
            <h3>My picks</h3>
            {draft.length > 0 && (
              <button className="link" onClick={() => library.clearDraft()}>
                Clear
              </button>
            )}
          </div>
          {draft.length === 0 ? (
            <p className="muted">Tap <strong>+</strong> on any suggestion to collect songs here.</p>
          ) : (
            <>
              <ul className="mini-list">
                {draft.map((t) => (
                  <li key={t.id}>
                    <Art track={t} className="art--xs" />
                    <span>
                      <strong>{t.title}</strong>
                      <em>{t.artist}</em>
                    </span>
                    <button className="icon-btn icon-btn--sm" onClick={() => library.removeFromDraft(t.id)} aria-label={`Remove ${t.title}`}>
                      <Icon name="close" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                className="save-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  library.save(name || "My picks", "custom", draft);
                  library.clearDraft();
                  setName("");
                }}
              >
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this playlist" aria-label="Playlist name" maxLength={60} />
                <button className="btn btn--primary" type="submit">
                  Save
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => onShare({ name: name || "My picks", subtitle: `${draft.length} songs · picked with Similar Song AI`, tracks: withArt(draft) })}>
                  <Icon name="share" size={18} /> Card
                </button>
              </form>
            </>
          )}
        </section>

        <section className="drawer__section">
          <h3>Saved playlists</h3>
          {playlists.length === 0 && <p className="muted">Nothing saved yet. Save a set of suggestions or a journey and it will live here, in this browser.</p>}
          <ul className="pl-list">
            {playlists.map((p) => (
              <li key={p.id} className="pl glass">
                <div className="pl__covers" aria-hidden="true">
                  {p.tracks.slice(0, 3).map((t) => (
                    <Art key={t.id} track={t} className="art--xs" />
                  ))}
                </div>
                <div className="pl__meta">
                  <strong>{p.name}</strong>
                  <span>
                    {kindLabel[p.kind]} · {p.tracks.length} songs
                  </span>
                </div>
                <div className="pl__actions">
                  <button className="icon-btn icon-btn--sm" onClick={() => player.play(p.tracks[0], p.tracks)} aria-label={`Play ${p.name}`}>
                    <Icon name="play" size={18} />
                  </button>
                  <button className="icon-btn icon-btn--sm" onClick={() => onShare({ name: p.name, subtitle: `${p.tracks.length} songs · ${kindLabel[p.kind]}`, tracks: withArt(p.tracks) })} aria-label={`Share card for ${p.name}`}>
                    <Icon name="share" size={18} />
                  </button>
                  <button
                    className={`icon-btn icon-btn--sm ${confirmDelete === p.id ? "is-danger" : ""}`}
                    onClick={() => {
                      if (confirmDelete === p.id) {
                        library.remove(p.id);
                        setConfirmDelete(null);
                      } else {
                        setConfirmDelete(p.id);
                        setTimeout(() => setConfirmDelete((c) => (c === p.id ? null : c)), 2500);
                      }
                    }}
                    aria-label={confirmDelete === p.id ? `Confirm delete ${p.name}` : `Delete ${p.name}`}
                    title={confirmDelete === p.id ? "Click again to delete" : "Delete"}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
                <details className="pl__tracks">
                  <summary>Songs</summary>
                  <ol>
                    {p.tracks.map((t) => (
                      <li key={t.id}>
                        <button className="link" onClick={() => player.play(t, p.tracks)}>
                          {t.title}
                        </button>{" "}
                        <em>{t.artist}</em>
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </>
  );
}
