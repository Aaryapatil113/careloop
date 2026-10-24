import { runEvals } from "@/lib/evals";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(runEvals());
}
