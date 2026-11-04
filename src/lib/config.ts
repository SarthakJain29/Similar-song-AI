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
  get geminiModel() {
    return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
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
