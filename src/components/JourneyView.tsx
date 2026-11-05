"use client";
import { displayTitle } from "@/lib/music/normalize";
import { useEffect, useMemo, useState } from "react";
import { apiJourney } from "@/lib/client/api";
import { library, toPlaylistTrack, useLibrary } from "@/lib/client/library";
import { setBackdropArt } from "@/lib/client/backdrop";
import { primeHydration, useHydration } from "@/lib/client/hydration";
import { trackId } from "@/lib/music/normalize";
import type { JourneyResponse, PlaylistTrack, SearchHit, TrackRef } from "@/lib/types";
import { useResource } from "@/hooks/useAsync";
import { usePlayer } from "@/hooks/player";
import { Art } from "./Art";
import { Icon } from "./Logo";
import { SearchBox } from "./SearchBox";
import { PlayOverlay, TrackRow } from "./TrackRow";
import { useExplanations } from "./useExplanations";

export interface JourneyParams {
  start: TrackRef | null;
  end: TrackRef | null;
  steps: number;
}

interface Props {
  params: JourneyParams;
  onSubmit: (p: { start: SearchHit; end: SearchHit; steps: number } | { start: TrackRef; end: TrackRef; steps: number }) => void;
}

const label = (r: TrackRef | null) => (r ? `${r.title} — ${r.artist}` : "");

export function JourneyView({ params, onSubmit }: Props) {
  const [start, setStart] = useState<TrackRef | null>(params.start);
  const [end, setEnd] = useState<TrackRef | null>(params.end);
  const [steps, setSteps] = useState(params.steps);
  const ready = start && end;

  const key = params.start && params.end ? `${trackId(params.start)}>${trackId(params.end)}#${params.steps}` : null;
  const [progress, setProgress] = useState({ message: "Starting…", fraction: 0 });
  const res = useResource<JourneyResponse>(key, (signal) => apiJourney(params.start!, params.end!, params.steps, (message, fraction) => setProgress({ message, fraction }), signal));

  return (
    <div className="journey">
      <div className="journey__intro">
        <p className="eyebrow">Journey mode</p>
        <h1 className="display">From here to there, one song at a time.</h1>
        <p className="lede">Pick two songs. We’ll build a playlist that drifts gradually from the first vibe to the second.</p>
      </div>

      <form
        className="journey__form glass"
        onSubmit={(e) => {
          e.preventDefault();
          if (start && end) onSubmit({ start, end, steps });
        }}
      >
        <div className="journey__pick">
          <span className="journey__dot journey__dot--a" aria-hidden="true">A</span>
          <SearchBox label="Starting song" placeholder="Starting song…" initialText={label(params.start)} onSelect={setStart} />
        </div>
        <div className="journey__pick">
          <span className="journey__dot journey__dot--b" aria-hidden="true">B</span>
          <SearchBox label="Destination song" placeholder="Destination song…" initialText={label(params.end)} onSelect={setEnd} />
        </div>
        <div className="journey__controls">
          <label className="journey__steps">
            <span>
              Stops in between: <strong>{steps}</strong>
            </span>
            <input type="range" min={4} max={14} step={1} value={steps} onChange={(e) => setSteps(Number(e.target.value))} style={{ ["--pct" as string]: `${((steps - 4) / 10) * 100}%` }} />
          </label>
          <button className="btn btn--primary" type="submit" disabled={!ready || res.loading}>
            <Icon name="route" size={18} /> {res.loading ? "Building…" : "Build journey"}
          </button>
        </div>
      </form>

      {res.loading && (
        <div className="progress glass" role="status" aria-live="polite">
          <div className="progress__bar">
            <span style={{ width: `${Math.max(6, progress.fraction * 100)}%` }} />
          </div>
          <p>{progress.message}</p>
        </div>
      )}
      {res.error && (
        <div className="notice glass" role="alert">
          <strong>Couldn’t build that journey.</strong>
          <p>{res.error}</p>
        </div>
      )}
      {res.data && <JourneyResult data={res.data} />}
    </div>
  );
}

function JourneyResult({ data }: { data: JourneyResponse }) {
  const player = usePlayer();
  const { draft } = useLibrary();
  const inDraft = new Set(draft.map((d) => d.id));
  const startArt = useHydration(data.start)?.artwork ?? data.start.artwork;
  const scope = `j:${data.start.id}>${data.end.id}:${data.steps.length}`;
  const items = useMemo(() => data.steps.map((s) => ({ id: s.track.id, artist: s.track.artist, title: s.track.title })), [data]);
  const explain = useExplanations(scope, items, { start: data.start, end: data.end });
  useEffect(() => {
    setBackdropArt(startArt);
    primeHydration({ id: data.start.id, artwork: data.start.artwork });
  }, [startArt, data.start.id, data.start.artwork]);

  const all: PlaylistTrack[] = useMemo(() => [data.start, ...data.steps.map((s) => s.track), data.end].map((t) => toPlaylistTrack(t)), [data]);
  const [saved, setSaved] = useState(false);
  const toggleDraft = (t: PlaylistTrack) => (inDraft.has(t.id) ? library.removeFromDraft(t.id) : library.addToDraft(t));

  return (
    <section className="timeline" aria-label="Your journey">
      <div className="section-head">
        <h2>
          {data.start.title} <span className="arrow">→</span> {data.end.title}
        </h2>
        <div className="section-head__actions">
          <button className="btn btn--ghost" onClick={() => player.play(all[0], all)}>
            <Icon name="play" size={18} /> Play journey
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              library.save(`${data.start.title} → ${data.end.title}`, "journey", all);
              setSaved(true);
              setTimeout(() => setSaved(false), 2200);
            }}
          >
            <Icon name={saved ? "check" : "list"} size={18} /> {saved ? "Saved to library" : "Save as playlist"}
          </button>
        </div>
      </div>
      <ol className="timeline__list">
        <Endpoint kind="A" track={data.start} all={all} />
        {data.steps.map((s, i) => {
          const prevTags = i === 0 ? data.start.tags : data.steps[i - 1].track.tags;
          const kept = s.track.tags.filter((t) => prevTags.includes(t));
          return (
            <li className="stop" key={s.track.id} style={{ ["--p" as string]: s.progress }}>
              <span className="stop__node" aria-hidden="true" />
              <TrackRow
                track={s.track}
                index={i}
                sharedTags={[...new Set([...kept, ...s.sharedWithEnd])]}
                explanation={explain.get(s.track.id)}
                explaining={explain.pending(s.track.id)}
                queue={all}
                inDraft={inDraft.has(s.track.id)}
                onToggleDraft={toggleDraft}
                as="div"
                eyebrow={<span className="eyebrow eyebrow--sm">Stop {i + 1} · {Math.round(s.progress * 100)}% of the way</span>}
              />
            </li>
          );
        })}
        <Endpoint kind="B" track={data.end} all={all} />
      </ol>
      {data.mock && <p className="fineprint">Demo mode: built from a small built-in catalogue.</p>}
    </section>
  );
}

function Endpoint({ kind, track, all }: { kind: "A" | "B"; track: JourneyResponse["start"]; all: PlaylistTrack[] }) {
  const h = useHydration(track);
  const merged = { ...track, artwork: track.artwork ?? h?.artwork };
  return (
    <li className={`stop stop--end stop--${kind.toLowerCase()}`}>
      <span className="stop__node" aria-hidden="true">{kind}</span>
      <div className="endpoint glass">
        <Art track={merged} className="art--row">
          <PlayOverlay track={toPlaylistTrack({ ...merged, deezerId: track.deezerId ?? h?.deezerId })} queue={all} />
        </Art>
        <div>
          <p className="eyebrow eyebrow--sm">{kind === "A" ? "Start" : "Destination"}</p>
          <h3>{displayTitle(track.title)}</h3>
          <p>{track.artist}</p>
          <ul className="tags">
            {track.tags.slice(0, 5).map((t) => (
              <li key={t} className="chip chip--sm">{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}
