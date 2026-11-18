"use client";
import { useEffect, useRef, useState } from "react";

export interface Resource<T> {
  data?: T;
  error?: string;
  loading: boolean;
  /** Result of the previous key while a new one loads (for dimming instead of flashing). */
  previous?: T;
}

/**
 * Keyed async resource: re-fetches whenever `key` changes, aborts stale requests.
 * `loading` is derived (key !== loaded key) so no state is set synchronously inside the effect.
 */
export function useResource<T>(key: string | null, fetcher: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: string; prev?: T }>({ key: null });
  const fetchRef = useRef(fetcher);
  useEffect(() => {
    fetchRef.current = fetcher;
  });
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetchRef
      .current(ctrl.signal)
      .then((data) => !ctrl.signal.aborted && setState((s) => ({ key, data, prev: data ?? s.prev })))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ key, error: e instanceof Error ? e.message : "Something went wrong", prev: s.data ?? s.prev }));
      });
    return () => ctrl.abort();
  }, [key]);
  const current = key !== null && state.key === key;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && !current,
    previous: state.data ?? state.prev,
  };
}

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
