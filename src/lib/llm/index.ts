import { config } from "../config";
import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import type { LLMProvider } from "./provider";

/**
 * Providers to try, in order. `LLM_PROVIDER=auto` prefers Gemini then Groq,
 * so a rate-limited / failing provider transparently falls back to the other.
 */
export function activeProviders(): LLMProvider[] {
  const mode = config.llmProvider;
  if (mode === "none") return [];
  const all: LLMProvider[] = [];
  const gem = config.geminiKey ? geminiProvider : null;
  const groq = config.groqKey ? groqProvider : null;
  if (mode === "gemini") return gem ? [gem] : [];
  if (mode === "groq") return groq ? [groq] : [];
  if (gem) all.push(gem);
  if (groq) all.push(groq);
  return all;
}

export type { LLMProvider, LLMRequest } from "./provider";
