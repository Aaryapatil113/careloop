import { db, getMemory, getPatient, getTurns } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patient = getPatient(id);
  if (!patient) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({
    patient,
    turns: getTurns(id),
    memory: getMemory(id),
    escalations: db.escalations.filter((e) => e.patientId === id),
  });
}
