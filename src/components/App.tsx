"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { setBackdropArt, setPlayerArt } from "@/lib/client/backdrop";
import { useHydration } from "@/lib/client/hydration";
import { useLibrary } from "@/lib/client/library";
import type { SearchHit, TrackRef } from "@/lib/types";
import { PlayerProvider, usePlayer } from "@/hooks/player";
import { Backdrop } from "./Backdrop";
import { JourneyView, type JourneyParams } from "./JourneyView";
import { Icon, Logo } from "./Logo";
import { MiniPlayer } from "./MiniPlayer";
import { PlaylistDrawer } from "./PlaylistDrawer";
import { SearchBox } from "./SearchBox";
import { ShareModal, type ShareTarget } from "./ShareModal";
import { SimilarView } from "./SimilarView";

const EXAMPLES: TrackRef[] = [
  { artist: "Radiohead", title: "Creep" },
  { artist: "Daft Punk", title: "Get Lucky" },
  { artist: "Bon Iver", title: "Skinny Love" },
  { artist: "Kendrick Lamar", title: "Money Trees" },
];

const JOURNEY_EXAMPLE: { start: TrackRef; end: TrackRef } = { start: { artist: "Metallica", title: "Master of Puppets" }, end: { artist: "Bonobo", title: "Kerala" } };

const parseRef = (sp: URLSearchParams, a: string, t: string): TrackRef | null => {
  const artist = sp.get(a);
  const title = sp.get(t);
  return artist && title ? { artist, title } : null;
};

function PlayerBackdropBridge() {
  const p = usePlayer();
  const h = useHydration(p.current);
  const art = p.current ? (p.current.artwork ?? h?.artwork) : undefined;
  useEffect(() => {
    setPlayerArt(art);
  }, [art]);
  return null;
}

function Shell() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp.get("m") === "journey" ? "journey" : "similar";
  const seed = parseRef(sp, "a", "t");
  const jStart = parseRef(sp, "a", "t");
  const jEnd = parseRef(sp, "a2", "t2");
  const steps = Math.min(14, Math.max(4, Number(sp.get("n")) || 8));
  const { playlists, draft } = useLibrary();
  const [drawer, setDrawer] = useState(false);
  const [share, setShare] = useState<ShareTarget | null>(null);
  const [demo, setDemo] = useState<{ mock: boolean; llm: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setDemo)
      .catch(() => {});
  }, []);

  const go = useCallback((params: Record<string, string>) => router.push(`/?${new URLSearchParams(params)}`, { scroll: false }), [router]);

  const pickSeed = (hit: TrackRef) => go({ a: hit.artist, t: hit.title });
  const startJourney = (p: { start: TrackRef; end: TrackRef; steps: number }) => go({ m: "journey", a: p.start.artist, t: p.start.title, a2: p.end.artist, t2: p.end.title, n: String(p.steps) });

  const journeyParams: JourneyParams = { start: jStart, end: jEnd, steps };
  const noArt = mode === "journey" ? !jStart : !seed;
  useEffect(() => {
    if (noArt) setBackdropArt(undefined);
  }, [noArt]);

  const collected = draft.length;
  return (
    <>
      <Backdrop />
      <PlayerBackdropBridge />
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Similar Song AI home">
          <Logo />
          <span>Similar Song AI</span>
        </Link>
        <nav className="tabs glass" aria-label="Mode">
          <button className={mode === "similar" ? "is-on" : ""} aria-current={mode === "similar"} onClick={() => router.push(seed ? `/?a=${encodeURIComponent(seed.artist)}&t=${encodeURIComponent(seed.title)}` : "/")}>
            Similar
          </button>
          <button className={mode === "journey" ? "is-on" : ""} aria-current={mode === "journey"} onClick={() => router.push(jStart ? `/?m=journey&a=${encodeURIComponent(jStart.artist)}&t=${encodeURIComponent(jStart.title)}` : "/?m=journey")}>
            Journey
          </button>
        </nav>
        <button className="btn btn--ghost topbar__lib" onClick={() => setDrawer(true)} aria-label="Open library">
          <Icon name="list" size={18} />
          <span>Library</span>
          {collected + playlists.length > 0 && <b className="count">{collected || playlists.length}</b>}
        </button>
      </header>

      <main className="main">
        {mode === "similar" && !seed && <Hero onPick={pickSeed} onExample={pickSeed} onJourney={() => go({ m: "journey" })} />}
        {mode === "similar" && seed && (
          <div className="stack">
            <div className="stack__search">
              <SearchBox key={`${seed.artist}${seed.title}`} label="Search for a song" initialText={`${seed.title} — ${seed.artist}`} onSelect={pickSeed} />
            </div>
            <SimilarView key={`${seed.artist}|${seed.title}`} seed={seed} />
          </div>
        )}
        {mode === "journey" && (
          <JourneyView
            key={`${jStart?.artist}|${jStart?.title}|${jEnd?.artist}|${jEnd?.title}|${steps}`}
            params={journeyParams}
            onSubmit={startJourney}
          />
        )}
        {mode === "journey" && !jEnd && (
          <p className="try try--center">
            Try:{" "}
            <button className="link" onClick={() => startJourney({ ...JOURNEY_EXAMPLE, steps: 8 })}>
              {JOURNEY_EXAMPLE.start.title} → {JOURNEY_EXAMPLE.end.title}
            </button>
          </p>
        )}
      </main>

      <footer className="footer">
        <span>Similarity &amp; tags from Last.fm · previews &amp; artwork from Deezer · explanations by {demo?.llm.length ? demo.llm[0] === "gemini" ? "Gemini" : "Groq" : "tag templates"}</span>
        {demo?.mock && <span className="badge badge--warn">Demo data</span>}
      </footer>

      <MiniPlayer />
      <PlaylistDrawer open={drawer} onClose={() => setDrawer(false)} onShare={(t) => (setDrawer(false), setShare(t))} />
      {share && <ShareModal target={share} onClose={() => setShare(null)} />}
    </>
  );
}

function Hero({ onPick, onExample, onJourney }: { onPick: (h: SearchHit) => void; onExample: (r: TrackRef) => void; onJourney: () => void }) {
  return (
    <section className="hero">
      <p className="eyebrow">Music discovery, explained</p>
      <h1 className="display">
        Find the song <span className="grad">after</span> the song.
      </h1>
      <p className="lede">Drop in a track you love. Get suggestions with a plain-English reason for every pick — then steer by popularity, era and mood.</p>
      <SearchBox size="xl" label="Search for a song" placeholder="Try “Creep” or “Get Lucky”…" onSelect={onPick} autoFocus />
      <p className="try">
        Try:{" "}
        {EXAMPLES.map((e) => (
          <button key={e.title} className="chip chip--btn" onClick={() => onExample(e)}>
            {e.title} <span>· {e.artist}</span>
          </button>
        ))}
      </p>
      <button className="hero__journey glass" onClick={onJourney}>
        <span className="hero__journey-icon">
          <Icon name="route" size={22} />
        </span>
        <span>
          <strong>Journey mode</strong>
          <em>Build a playlist that glides from one song to another.</em>
        </span>
      </button>
    </section>
  );
}

export function App() {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  );
}
