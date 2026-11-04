import { config } from "../config";
import { fetchJson } from "../http";
import type { LLMProvider, LLMRequest } from "./provider";

interface GroqResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export const groqProvider: LLMProvider = {
  name: "groq",
  async completeJSON({ system, user, maxTokens = 2048 }: LLMRequest) {
    const model = config.groqModel;
    const data = await fetchJson<GroqResponse>("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      timeoutMs: 25000,
      retries: 1,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.groqKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_completion_tokens: maxTokens,
        response_format: { type: "json_object" },
        ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new Error("Groq returned no text");
    return text;
  },
};
