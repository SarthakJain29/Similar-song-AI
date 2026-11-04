"use client";
import { useEffect, useRef, useState } from "react";
import { renderShareCard } from "@/lib/client/shareCard";
import type { PlaylistTrack } from "@/lib/types";
import { Icon } from "./Logo";

export interface ShareTarget {
  name: string;
  subtitle: string;
  tracks: PlaylistTrack[];
}

export function ShareModal({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const [state, setState] = useState<{ url?: string; blob?: Blob; error?: string }>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    renderShareCard(target.name, target.subtitle, target.tracks)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setState({ url, blob });
      })
      .catch((e: unknown) => !cancelled && setState({ error: e instanceof Error ? e.message : "Couldn't render the card" }));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [target]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filename = `${target.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "playlist"}.png`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  async function share() {
    if (!state.blob) return;
    const file = new File([state.blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: target.name });
      } catch {
        /* user cancelled */
      }
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Share card" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel glass glass--strong">
        <button ref={closeRef} className="icon-btn modal__close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
        <h2>Share card</h2>
        <div className="modal__preview">
          {state.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.url} alt={`Share card for ${target.name}`} />
          ) : state.error ? (
            <p className="notice">{state.error}</p>
          ) : (
            <div className="shimmer" style={{ aspectRatio: "4 / 5", width: "100%", borderRadius: 20 }} />
          )}
        </div>
        <div className="modal__actions">
          <a className={`btn btn--primary ${state.url ? "" : "is-disabled"}`} href={state.url} download={filename} aria-disabled={!state.url}>
            <Icon name="download" size={18} /> Download PNG
          </a>
          {canShare && (
            <button className="btn btn--ghost" onClick={share} disabled={!state.blob}>
              <Icon name="share" size={18} /> Share…
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
