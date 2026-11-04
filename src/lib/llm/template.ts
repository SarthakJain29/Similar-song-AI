import type { Explanation } from "../types";
import type { ExplainFacts } from "./facts";

const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic, always-grounded explanation. Used when no LLM is available or its output fails the guard. */
export function templateExplanation(f: ExplainFacts): Explanation {
  const evidence: string[] = [];
  const parts: string[] = [];
  const shared = f.sharedTags.slice(0, 3);

  if (f.journey) {
    const toward = f.journey.sharedWithDestination.slice(0, 2);
    if (shared.length) {
      parts.push(`Keeps the ${list(shared)} feel of ${f.reference}`);
      evidence.push(...shared);
    } else {
      parts.push(`A stepping stone from ${f.reference}`);
    }
    if (toward.length) {
      parts.push(`while leaning toward ${f.journey.destination} through ${list(toward)}`);
      evidence.push(...toward);
    }
    return { id: f.id, text: parts.join(" ") + ".", evidence, source: "template" };
  }

  if (shared.length) {
    const openers = [
      `Shares ${list(shared)} with ${f.reference}`,
      `Sits in the same ${list(shared)} space as ${f.reference}`,
      `Like ${f.reference}, it leans ${list(shared)}`,
    ];
    parts.push(openers[hash(f.id) % openers.length]);
    evidence.push(...shared);
  } else if (f.targetOnlyTags.length) {
    parts.push(`Tagged ${list(f.targetOnlyTags.slice(0, 2))}, it connects to ${f.reference} through listening habits rather than shared tags`);
    evidence.push(...f.targetOnlyTags.slice(0, 2));
  } else {
    parts.push(`Connected to ${f.reference} by listening patterns`);
  }

  const extras: string[] = [];
  if (f.sameArtist) {
    extras.push("it comes from the same artist");
    evidence.push("sameArtist");
  }
  if (f.lastfmMatchPercent !== undefined) {
    extras.push(`Last.fm listeners rate it ${f.lastfmMatchPercent}% similar`);
    evidence.push("lastfmMatch");
  }
  return { id: f.id, text: parts[0] + (extras.length ? `; ${extras.join(" and ")}` : "") + ".", evidence, source: "template" };
}
