"use client";
import { useEffect, useRef, useState } from "react";
import { apiExplainJourney, apiExplainSimilar } from "@/lib/client/api";
import type { Explanation, TrackRef } from "@/lib/types";

interface Item extends TrackRef {
  id: string;
}

/**
 * Fetches "why it's similar" blurbs for rows that don't have one yet.
 * `scope` namespaces the cache (seed id / journey id) so unrelated lists never mix.
 */
export function useExplanations(scope: string, items: Item[], ctx: { seed?: TrackRef; start?: TrackRef; end?: TrackRef }) {
  const [map, setMap] = useState<Record<string, Explanation>>({});
  const inflight = useRef(new Set<string>());
  const [failed, setFailed] = useState<string | null>(null);
  const signature = items.map((i) => i.id).join("|");

  useEffect(() => {
    if (!scope || !items.length) return;
    const missing = items.filter((i) => !map[`${scope}|${i.id}`] && !inflight.current.has(`${scope}|${i.id}`));
    if (!missing.length) return;
    missing.forEach((m) => inflight.current.add(`${scope}|${m.id}`));
    const ctrl = new AbortController();
    const run = ctx.start && ctx.end ? apiExplainJourney(ctx.start, ctx.end, items, ctrl.signal) : ctx.seed ? apiExplainSimilar(ctx.seed, missing, ctrl.signal) : Promise.resolve([] as Explanation[]);
    run
      .then((list) => {
        if (ctrl.signal.aborted) return;
        setMap((prev) => {
          const next = { ...prev };
          for (const e of list) next[`${scope}|${e.id}`] = e;
          return next;
        });
      })
      .catch(() => !ctrl.signal.aborted && setFailed(scope))
      .finally(() => missing.forEach((m) => inflight.current.delete(`${scope}|${m.id}`)));
    return () => ctrl.abort();
    // `items`/`ctx` are represented by `signature` + `scope`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, signature]);

  return {
    get: (id: string) => map[`${scope}|${id}`],
    /** true while an explanation for this id is still being fetched */
    pending: (id: string) => !map[`${scope}|${id}`] && failed !== scope,
  };
}
