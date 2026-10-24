import { isLive } from "@/lib/llm";
import { db, getMemory, getTurns } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    mode: isLive() ? "live" : "demo",
    patients: db.patients.map((p) => ({
      ...p,
      openEscalations: db.escalations.filter((e) => e.patientId === p.id && e.status === "open").length,
      memoryCount: getMemory(p.id).length,
      lastMessageAt: getTurns(p.id).at(-1)?.at ?? null,
    })),
  });
}
