import { fold } from "../music/normalize";
import { allowedEvidence, allowedNumbers, factsCorpus, type ExplainFacts } from "./facts";

/**
 * Best-effort guard against invented facts. The primary defence is the prompt
 * (facts-only), the secondary defence is this check on the model's output:
 *  - every number must come from the facts,
 *  - every capitalised word mid-sentence (proper noun) must appear in the facts,
 *  - cited evidence must be real fact keys,
 *  - no links / markdown / over-long text.
 * Anything that fails is replaced by the deterministic template explanation.
 */
export function checkGrounding(text: string, evidence: unknown, facts: ExplainFacts): { ok: true; evidence: string[] } | { ok: false; reason: string } {
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: "empty" };
  if (text.length > 260) return { ok: false, reason: "too long" };
  if (/https?:|www\.|[`*_#<>[\]{}]/.test(text)) return { ok: false, reason: "markup" };

  const allowed = allowedEvidence(facts);
  const ev = Array.isArray(evidence) ? evidence.filter((e): e is string => typeof e === "string") : [];
  // be lenient about formatting ("tag: house", "lastfmMatchPercent"), strict about substance
  const normEv = (e: string) => {
    const x = e.replace(/^[\w ]{2,20}:\s*/, "").trim().toLowerCase().replace(/\s+/g, " ");
    return x === "lastfmmatchpercent" || x === "lastfmmatch" ? "lastfmMatch" : x === "sameartist" ? "sameArtist" : x;
  };
  const cleanEv = ev.map(normEv).filter((e) => allowed.has(e));
  if (!cleanEv.length) return { ok: false, reason: "no valid evidence" };

  const nums = allowedNumbers(facts);
  for (const m of text.matchAll(/\d+/g)) {
    if (!nums.has(m[0])) return { ok: false, reason: `unknown number ${m[0]}` };
  }

  const vocab = new Set(fold(factsCorpus(facts)).split(" ").filter(Boolean));
  const words = [...text.matchAll(/[A-Za-zÀ-ɏ][\w'’.À-ɏ-]*/g)];
  for (const w of words) {
    const word = w[0];
    if (!/^[A-ZÀ-Þ]/.test(word)) continue;
    const idx = w.index ?? 0;
    const before = text.slice(0, idx).trimEnd();
    const sentenceStart = before === "" || /[.!?]$/.test(before);
    if (sentenceStart) continue;
    const f = fold(word.replace(/[’']s$/, ""));
    if (!f || f.split(" ").every((part) => vocab.has(part))) continue;
    return { ok: false, reason: `unknown name ${word}` };
  }
  return { ok: true, evidence: [...new Set(cleanEv)] };
}
