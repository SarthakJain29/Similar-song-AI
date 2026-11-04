"use client";
import { useEffect, useMemo, useState } from "react";
import { apiSimilar, vibeQuery } from "@/lib/client/api";
import { useHydration } from "@/lib/client/hydration";
import { library, toPlaylistTrack, useLibrary } from "@/lib/client/library";
import { setBackdropArt } from "@/lib/client/backdrop";
import { trackId } from "@/lib/music/normalize";
import { DEFAULT_VIBE, type PlaylistTrack, type TrackRef, type VibeSettings } from "@/lib/types";
import { useDebounced, useResource } from "@/hooks/useAsync";
import { Art } from "./Art";
import { Icon } from "./Logo";
import { PlayOverlay, TrackRow } from "./TrackRow";
import { VibePanel } from "./VibePanel";
import { useExplanations } from "./useExplanations";

export function SimilarView({ seed }: { seed: TrackRef }) {
  const seedId = trackId(seed);
  const [vibe, setVibe] = useState<VibeSettings>(DEFAULT_VIBE);
  const committed = useDebounced(vibe, 450);
  const key = `${seedId}|${vibeQuery(committed)}`;
  const res = useResource(key, (signal) => apiSimilar(seed, committed, signal));
  const { draft } = useLibrary();

  // While a re-rank loads, keep showing the previous list (only if it belongs to this seed).
  const data = res.data ?? (res.previous && trackId(res.previous.seed) === seedId ? res.previous : undefined);
  const seedTrack = data?.seed ?? { ...seed, id: seedId, tags: [] as string[] };
  const h = useHydration(seedTrack);
  const art = seedTrack.artwork ?? h?.artwork;
  useEffect(() => setBackdropArt(art), [art]);

  const items = useMemo(() => (data?.results ?? []).map((r) => ({ id: r.track.id, artist: r.track.artist, title: r.track.title })), [data]);
  const explain = useExplanations(seedId, items, { seed });
  const queue: PlaylistTrack[] = useMemo(() => (data?.results ?? []).map((r) => toPlaylistTrack({ ...r.track })), [data]);
  const inDraft = new Set(draft.map((d) => d.id));
  const busy = res.loading && Boolean(data);

  const toggleDraft = (t: PlaylistTrack) => (inDraft.has(t.id) ? library.removeFromDraft(t.id) : library.addToDraft(t));
  const [savedMsg, setSavedMsg] = useState(false);
  const saveAll = () => {
    if (!data) return;
    library.save(`Like ${data.seed.title}`, "similar", [toPlaylistTrack({ ...data.seed, artwork: art }), ...data.results.map((r) => toPlaylistTrack(r.track))]);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2200);
  };

  return (
    <div className="similar">
      <aside className="similar__side">
        <div className="seed glass">
          <Art track={{ ...seedTrack, artwork: art }} className="art--seed">
            <PlayOverlay track={toPlaylistTrack({ ...seedTrack, artwork: art, deezerId: seedTrack.deezerId ?? h?.deezerId })} />
          </Art>
          <p className="eyebrow">Because you like</p>
          <h1 className="seed__title">{seedTrack.title}</h1>
          <p className="seed__artist">
            {seedTrack.artist}
            {(seedTrack.year ?? h?.year) ? ` · ${seedTrack.year ?? h?.year}` : ""}
          </p>
          {seedTrack.tags.length > 0 && (
            <ul className="tags">
              {seedTrack.tags.slice(0, 6).map((t) => (
                <li key={t} className="chip chip--sm">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        <VibePanel vibe={vibe} onChange={setVibe} busy={busy} />
      </aside>

      <section className="similar__main" aria-live="polite">
        <div className="section-head">
          <h2>Songs to play next</h2>
          {data && data.results.length > 0 && (
            <button className="btn btn--ghost" onClick={saveAll}>
              <Icon name={savedMsg ? "check" : "list"} size={18} /> {savedMsg ? "Saved to library" : "Save as playlist"}
            </button>
          )}
        </div>
        {res.error && !data && (
          <div className="notice glass" role="alert">
            <strong>Couldn’t load suggestions.</strong>
            <p>{res.error}</p>
          </div>
        )}
        {!data && !res.error && <ResultsSkeleton />}
        {data && (
          <ol className={`rows ${busy ? "is-busy" : ""}`}>
            {data.results.map((r, i) => (
              <TrackRow key={r.track.id} track={r.track} index={i} match={r.match} sharedTags={r.sharedTags} explanation={explain.get(r.track.id)} explaining={explain.pending(r.track.id)} queue={queue} inDraft={inDraft.has(r.track.id)} onToggleDraft={toggleDraft} />
            ))}
          </ol>
        )}
        {data && data.results.length === 0 && (
          <div className="notice glass">
            <strong>No close matches.</strong>
            <p>Last.fm doesn’t know many songs like this one yet. Try loosening the vibe controls or a different song.</p>
          </div>
        )}
        {data?.mock && <p className="fineprint">Demo mode: showing a small built-in catalogue because no Last.fm key is configured.</p>}
      </section>
    </div>
  );
}

export function ResultsSkeleton() {
  return (
    <ol className="rows" aria-busy="true" aria-label="Loading suggestions">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="row glass row--skeleton" style={{ ["--i" as string]: i }}>
          <div className="art art--row shimmer" />
          <div className="row__main">
            <span className="shimmer" style={{ width: "42%", height: 18 }} />
            <span className="shimmer shimmer--short" style={{ marginTop: 10 }} />
            <span className="shimmer" style={{ marginTop: 10, width: "80%" }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
