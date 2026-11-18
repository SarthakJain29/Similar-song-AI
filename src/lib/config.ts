/** Central place for environment access. Server-only: never import in client components. */

export const config = {
  get lastfmKey() {
    return process.env.LASTFM_API_KEY?.trim() || "";
  },
  get geminiKey() {
    return process.env.GEMINI_API_KEY?.trim() || "";
  },
  get groqKey() {
    return process.env.GROQ_API_KEY?.trim() || "";
  },
  /** Comma-separated list, tried in order (Google retires / rate-limits free-tier models often). */
  get geminiModels() {
    return (process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite,gemini-flash-lite-latest").split(",").map((m) => m.trim()).filter(Boolean);
  },
  get groqModel() {
    return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";
  },
  get llmProvider() {
    return (process.env.LLM_PROVIDER?.trim().toLowerCase() || "auto") as "auto" | "gemini" | "groq" | "none";
  },
  /** Mock mode: forced via MOCK_MODE=1, or implied by a missing Last.fm key. */
  get mock() {
    return process.env.MOCK_MODE === "1" || !this.lastfmKey;
  },
};
