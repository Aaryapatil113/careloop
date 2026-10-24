import { runCoach } from "@/lib/coach";
import { getPatient } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams coach events as newline-delimited JSON. */
export async function POST(req: Request) {
  const { patientId, message } = (await req.json()) as { patientId?: string; message?: string };
  if (!patientId || !getPatient(patientId) || !message?.trim()) {
    return Response.json({ error: "patientId and message are required" }, { status: 400 });
  }
  const text = message.trim().slice(0, 2000);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runCoach(patientId, text)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (e) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: String(e) }) + "\n"));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}
