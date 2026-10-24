import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const { id } = (await req.json()) as { id?: string };
  const e = db.escalations.find((x) => x.id === id);
  if (!e) return Response.json({ error: "Not found" }, { status: 404 });
  e.status = "acknowledged";
  return Response.json(e);
}
