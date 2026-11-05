/** Minimal provider abstraction: any model that can return a JSON string for (system, user). */
export interface LLMRequest {
  system: string;
  user: string;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: "gemini" | "groq";
  /** Returns the raw model output, which the caller must parse + validate. */
  completeJSON(req: LLMRequest): Promise<string>;
}
