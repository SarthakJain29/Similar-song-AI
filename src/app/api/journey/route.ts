import { fail, rateLimit, ref } from "@/lib/api";
import { NotFoundError, journey } from "@/lib/recommend";

export const maxDuration = 60;

/** Streams newline-delimited JSON: {type:"progress",message,fraction} ... {type:"result",data} | {type:"error",message}. */
export async function POST(req: Request) {
  if (!rateLimit(req, "journey", 6, 60_000)) return fail("Slow down a little", 429);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON");
  }
  const start = ref(body.start);
  const end = ref(body.end);
  if (!start || !end) return fail("start and end are required");
  const steps = Math.min(16, Math.max(4, Number(body.steps) || 8));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const data = await journey(start, end, steps, (message, fraction) => send({ type: "progress", message, fraction }));
        send({ type: "result", data });
      } catch (e) {
        if (!(e instanceof NotFoundError)) console.warn("[journey]", e instanceof Error ? e.message : e);
        send({ type: "error", message: e instanceof NotFoundError ? e.message : "Couldn't build that journey right now. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
