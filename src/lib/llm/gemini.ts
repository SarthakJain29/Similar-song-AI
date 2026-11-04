import { config } from "../config";
import { fetchJson } from "../http";
import type { LLMProvider, LLMRequest } from "./provider";

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

export const geminiProvider: LLMProvider = {
  name: "gemini",
  async completeJSON({ system, user, maxTokens = 2048 }: LLMRequest) {
    const model = config.geminiModel;
    const data = await fetchJson<GeminiResponse>(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      timeoutMs: 25000,
      retries: 1,
      headers: { "Content-Type": "application/json", "x-goog-api-key": config.geminiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
          // 2.5-flash "thinks" by default, which is slow and unnecessary for this task
          ...(model.includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text) throw new Error("Gemini returned no text");
    return text;
  },
};
