"use client";
import { MOODS } from "@/lib/music/tags";
import { DEFAULT_VIBE, type VibeSettings } from "@/lib/types";

interface SliderProps {
  id: string;
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}

function VibeSlider({ id, label, left, right, value, onChange }: SliderProps) {
  const pct = ((value + 1) / 2) * 100;
  return (
    <div className="vibe__slider">
      <div className="vibe__label">
        <label htmlFor={id}>{label}</label>
        <span>{value === 0 ? "Balanced" : value < 0 ? left : right}</span>
      </div>
      <input id={id} type="range" min={-10} max={10} step={1} value={Math.round(value * 10)} onChange={(e) => onChange(Number(e.target.value) / 10)} style={{ ["--pct" as string]: `${pct}%` }} aria-valuetext={value === 0 ? "Balanced" : value < 0 ? `More ${left.toLowerCase()}` : `More ${right.toLowerCase()}`} />
      <div className="vibe__ends" aria-hidden="true">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

export function VibePanel({ vibe, onChange, busy }: { vibe: VibeSettings; onChange: (v: VibeSettings) => void; busy?: boolean }) {
  const dirty = vibe.popularity !== 0 || vibe.era !== 0 || vibe.energy !== 0 || vibe.moods.length > 0;
  const toggleMood = (id: string) => onChange({ ...vibe, moods: vibe.moods.includes(id) ? vibe.moods.filter((m) => m !== id) : [...vibe.moods, id] });
  return (
    <section className="vibe glass" aria-label="Vibe controls">
      <header className="vibe__head">
        <h2>Tune the vibe</h2>
        {busy && <span className="spinner spinner--sm" aria-label="Updating" />}
        {dirty && (
          <button className="link" onClick={() => onChange(DEFAULT_VIBE)}>
            Reset
          </button>
        )}
      </header>
      <VibeSlider id="vibe-pop" label="Popularity" left="Obscure" right="Popular" value={vibe.popularity} onChange={(popularity) => onChange({ ...vibe, popularity })} />
      <VibeSlider id="vibe-era" label="Era" left="Older" right="Newer" value={vibe.era} onChange={(era) => onChange({ ...vibe, era })} />
      <VibeSlider id="vibe-energy" label="Energy" left="Calm" right="Intense" value={vibe.energy} onChange={(energy) => onChange({ ...vibe, energy })} />
      <div className="vibe__moods" role="group" aria-label="Mood">
        {MOODS.map((m) => (
          <button key={m.id} type="button" className={`chip chip--btn ${vibe.moods.includes(m.id) ? "is-on" : ""}`} aria-pressed={vibe.moods.includes(m.id)} onClick={() => toggleMood(m.id)}>
            <span aria-hidden="true">{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>
    </section>
  );
}
