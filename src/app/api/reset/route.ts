import { resetDemo } from "@/lib/store";

export function POST() {
  resetDemo();
  return Response.json({ ok: true });
}
