"use client";
import { displayTitle } from "@/lib/music/normalize";
import { useEffect, useId, useRef, useState } from "react";
import { apiSearch } from "@/lib/client/api";
import { primeHydration } from "@/lib/client/hydration";
import type { SearchHit } from "@/lib/types";
import { useDebounced } from "@/hooks/useAsync";
import { Art } from "./Art";
import { Icon } from "./Logo";

interface Props {
  label: string;
  placeholder?: string;
  size?: "xl" | "md";
  autoFocus?: boolean;
  /** Text shown after a song is chosen (and when URL state changes). */
  initialText?: string;
  onSelect: (hit: SearchHit) => void;
}

export function SearchBox({ label, placeholder = "Search a song or artist…", size = "md", autoFocus, initialText = "", onSelect }: Props) {
  const [text, setText] = useState(initialText);
  const [hits, setHits] = useState<{ q: string; items: SearchHit[] }>({ q: "", items: [] });
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(initialText);
  const q = useDebounced(text.trim(), 170);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  const searchable = q.length >= 2 && q !== picked;
  useEffect(() => {
    if (!searchable) return;
    const ctrl = new AbortController();
    apiSearch(q, ctrl.signal)
      .then((items) => {
        if (ctrl.signal.aborted) return;
        setHits({ q, items });
        setError(false);
        setActive(-1);
      })
      .catch(() => !ctrl.signal.aborted && setError(true));
    return () => ctrl.abort();
  }, [q, searchable]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const loading = searchable && hits.q !== q && !error;
  const items = searchable && hits.q === q ? hits.items : [];
  const showList = open && searchable && (items.length > 0 || loading || error || hits.q === q);

  function choose(hit: SearchHit) {
    const label = `${hit.title} — ${hit.artist}`;
    primeHydration({ id: hit.id, artwork: hit.artwork, album: hit.album, deezerId: hit.deezerId });
    setText(label);
    setPicked(label);
    setOpen(false);
    onSelect(hit);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      const hit = items[active >= 0 ? active : 0];
      if (hit && showList) {
        e.preventDefault();
        choose(hit);
      }
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className={`search search--${size}`} ref={rootRef}>
      <label className="search__field glass">
        <span className="sr-only">{label}</span>
        <Icon name="search" size={size === "xl" ? 26 : 20} />
        <input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onKeyDown={onKey}
        />
        {loading && <span className="spinner" aria-label="Searching" />}
      </label>
      {showList && (
        <ul className="search__list glass glass--strong" id={listId} role="listbox" aria-label={`${label} suggestions`}>
          {items.map((h, i) => (
            <li key={h.id + i} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(h)}>
              <Art track={h} className="art--xs" />
              <span className="search__meta">
                <strong>{displayTitle(h.title)}</strong>
                <span>
                  {h.artist}
                  {h.album ? ` · ${h.album}` : ""}
                </span>
              </span>
            </li>
          ))}
          {loading && items.length === 0 && <li className="search__note">Searching…</li>}
          {!loading && !error && items.length === 0 && <li className="search__note">No songs found. Try another spelling.</li>}
          {error && <li className="search__note">Search is unavailable right now.</li>}
        </ul>
      )}
    </div>
  );
}
