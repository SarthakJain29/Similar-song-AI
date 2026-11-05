"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { setBackdropArt } from "@/lib/client/backdrop";
import { hydratedArtwork, useHydration } from "@/lib/client/hydration";
import { library, toPlaylistTrack } from "@/lib/client/library";
import { displayTitle } from "@/lib/music/normalize";
import { decodePlaylist, sharedToPlaylistTracks } from "@/lib/share-link";
import type { PlaylistTrack } from "@/lib/types";
import { useResource } from "@/hooks/useAsync";
import { usePlayer } from "@/hooks/player";
import { Art } from "./Art";
import { Icon } from "./Logo";
import { PlayOverlay } from "./TrackRow";

function Row({ track, index, queue }: { track: PlaylistTrack; index: number; queue: PlaylistTrack[] }) {
  const h = useHydration(track);
  const merged = { ...track, artwork: track.artwork ?? h?.artwork, deezerId: track.deezerId ?? h?.deezerId };
  return (
    <li className="row glass shared__row" style={{ ["--i" as string]: index }}>
      <Art track={merged} className="art--row">
        <PlayOverlay track={toPlaylistTrack(merged)} queue={queue} />
      </Art>
      <div className="row__main">
        <div className="row__title">
          <h3>{displayTitle(track.title)}</h3>
          <p>{track.artist}</p>
        </div>
      </div>
      <span className="shared__n" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
    </li>
  );
}

/** Read-only view of a playlist shared via link (?s=…). */
export function SharedView({ code }: { code: string }) {
  const router = useRouter();
  const player = usePlayer();
  const res = useResource(code, () => decodePlaylist(code));
  const [saved, setSaved] = useState(false);
  const tracks = useMemo(() => (res.data ? sharedToPlaylistTracks(res.data) : []), [res.data]);
  const first = useHydration(tracks[0]);
  const art = first?.artwork;
  useEffect(() => setBackdropArt(art), [art]);

  if (res.loading) return <div className="notice glass">Opening playlist…</div>;
  if (!res.data) {
    return (
      <div className="notice glass" role="alert">
        <strong>This playlist link isn’t valid.</strong>
        <p>It may have been cut off when it was copied. Ask for a fresh link, or start a new search.</p>
        <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => router.push("/")}>Start exploring</button>
      </div>
    );
  }
  const save = () => {
    library.save(res.data!.name, "custom", tracks.map((t) => ({ ...t, artwork: hydratedArtwork(t) })));
    setSaved(true);
  };
  return (
    <section className="shared">
      <p className="eyebrow">Shared playlist</p>
      <h1 className="display shared__title">{res.data.name}</h1>
      <p className="lede">{tracks.length} songs · previews are 30-second clips</p>
      <div className="section-head__actions" style={{ margin: "20px 0 24px" }}>
        <button className="btn btn--primary" onClick={() => player.play(tracks[0], tracks)}>
          <Icon name="play" size={18} /> Play all
        </button>
        <button className="btn btn--ghost" onClick={save} disabled={saved}>
          <Icon name={saved ? "check" : "list"} size={18} /> {saved ? "Saved to your library" : "Save to my library"}
        </button>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>Find similar songs</button>
      </div>
      <ol className="rows">
        {tracks.map((t, i) => (
          <Row key={t.id + i} track={t} index={i} queue={tracks} />
        ))}
      </ol>
    </section>
  );
}
