import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, isLive, MODEL } from "./llm";
import { db, getMemory, getPatient, getTurns } from "./store";

export const SummarySchema = z.object({
  headline: z.string().describe("One sentence on how the patient is doing overall"),
  progress: z.string().describe("Weight trend and adherence in one or two sentences"),
  symptoms: z.array(z.string()),
  safety_events: z.array(z.string()).describe("Escalations since last visit, with status"),
  barriers: z.array(z.string()),
  discussion_points: z.array(z.string()).describe("Suggested topics for the visit, phrased for a clinician"),
});
export type VisitSummary = z.infer<typeof SummarySchema> & { generatedBy: string };

/** Pre-visit brief so the clinician walks in knowing what happened between appointments. */
export async function previsitSummary(patientId: string): Promise<VisitSummary> {
  const p = getPatient(patientId);
  if (!p) throw new Error("Unknown patient");
  const memory = getMemory(patientId);
  const escalations = db.escalations.filter((e) => e.patientId === patientId);
  const turns = getTurns(patientId).filter((t) => t.role === "patient").slice(-15);
  const lost = p.startWeightLb - p.currentWeightLb;

  if (!isLive()) {
    const byCat = (c: string) => memory.filter((f) => f.category === c).map((f) => f.text);
    return {
      generatedBy: "template (demo mode)",
      headline: `${p.name} is ${Math.round((Date.now() - Date.parse(p.startedOn)) / 604_800_000)} weeks into ${p.medication}${escalations.some((e) => e.status === "open") ? " with open safety flags to review" : " and engaging with the coach"}.`,
      progress: `Down ${lost.toFixed(1)} lb (${((lost / p.startWeightLb) * 100).toFixed(1)}%) since start. ${turns.length} patient messages on record.`,
      symptoms: byCat("symptom"),
      safety_events: escalations.map((e) => `${e.at.slice(0, 10)} · ${e.level} · ${e.reasons.join(", ")} (${e.status})`),
      barriers: byCat("barrier"),
      discussion_points: [
        ...(byCat("symptom").length ? ["Review GI tolerability before any dose change"] : []),
        ...(byCat("nutrition").length ? ["Protein intake and dietitian follow-up"] : []),
        ...(byCat("barrier").length ? ["Address reported barriers"] : []),
        ...(escalations.length ? ["Follow up on escalated events"] : []),
      ],
    };
  }

  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: zodOutputFormat(SummarySchema) },
    system:
      "You write concise pre-visit briefs for obesity-medicine clinicians from between-visit patient data. Be factual, use only the data provided, do not diagnose or recommend specific doses.",
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          patient: p,
          weight_change_lb: lost,
          memory: memory.map(({ category, text, at }) => ({ category, text, at })),
          escalations: escalations.map(({ level, reasons, message, at, status }) => ({ level, reasons, message, at, status })),
          recent_patient_messages: turns.map((t) => ({ at: t.at, text: t.text })),
        }),
      },
    ],
  });
  if (!response.parsed_output) throw new Error(`Summary unavailable (stop_reason: ${response.stop_reason})`);
  return { ...response.parsed_output, generatedBy: MODEL };
}
