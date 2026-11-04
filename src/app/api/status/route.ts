import { json } from "@/lib/api";
import { config } from "@/lib/config";
import { activeProviders } from "@/lib/llm";

/** Non-sensitive runtime info so the UI can show "demo mode" badges. Never returns keys. */
export async function GET() {
  return json({ mock: config.mock, llm: activeProviders().map((p) => p.name) }, { maxAge: 60 });
}
