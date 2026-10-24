import { db } from "@/lib/store";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ traces: db.traces });
}
