import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, isLive, MODEL } from "./llm";
import { id } from "./store";
import type { MemoryCategory, MemoryFact } from "./types";

const CATEGORIES = ["medication", "symptom", "nutrition", "activity", "goal", "preference", "barrier", "vitals"] as const;

const ExtractionSchema = z.object({
  facts: z.array(
    z.object({
      category: z.enum(CATEGORIES),
      text: z.string().describe("One short third-person fact, e.g. 'Nausea worse on day after injection'"),
      supersedes_existing: z
        .string()
        .nullable()
        .describe("Exact text of an existing fact this one replaces (e.g. an old dose), else null"),
    }),
  ),
});

const EXTRACT_SYSTEM = `You maintain a longitudinal memory for a patient on GLP-1 therapy, used by their AI coach and clinicians.
From the patient's latest message, extract only NEW, durable, clinically or behaviorally useful facts: medications and doses, symptoms (with timing/severity), nutrition habits, activity, goals, preferences for how they like to be coached, barriers, and self-reported vitals.
Skip greetings, questions without new information, and anything already captured in existing memory. Return an empty list when there is nothing new. Never infer diagnoses.`;

/** Extract new memory facts from a patient message. */
export async function extractMemory(message: string, existing: MemoryFact[]): Promise<MemoryFact[]> {
  const now = new Date().toISOString();
  const raw = isLive() ? await extractLive(message, existing) : extractHeuristic(message);
  const known = new Set(existing.map((f) => f.text.toLowerCase()));
  return raw
    .filter((f) => !known.has(f.text.toLowerCase()))
    .map((f) => ({
      id: id("m"),
      category: f.category,
      text: f.text,
      at: now,
      source: "conversation" as const,
      supersedes: f.supersedes ? existing.find((e) => e.text === f.supersedes)?.id : undefined,
    }));
}

type Draft = { category: MemoryCategory; text: string; supersedes?: string | null };

async function extractLive(message: string, existing: MemoryFact[]): Promise<Draft[]> {
  const response = await anthropic().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ExtractionSchema) },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Existing memory:\n${existing.map((f) => `- [${f.category}] ${f.text}`).join("\n") || "(none)"}\n\nLatest patient message:\n"""${message}"""`,
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return [];
  return response.parsed_output.facts.map((f) => ({ category: f.category, text: f.text, supersedes: f.supersedes_existing }));
}

/** Demo-mode extractor: pattern rules that cover the common facts patients share. */
export function extractHeuristic(message: string): Draft[] {
  const m = message.trim();
  const out: Draft[] = [];
  const dose = m.match(/\b(\d+(?:\.\d+)?)\s?mg\b/i);
  if (dose && /\b(on|taking|started|increased|now|moved|switched)\b/i.test(m)) {
    out.push({ category: "medication", text: `Reports current dose ${dose[1]} mg` });
  }
  const glucose = m.match(/\b(glucose|blood sugar|sugar)\D{0,20}(\d{2,3})\b/i);
  if (glucose) out.push({ category: "vitals", text: `Self-reported glucose ${glucose[2]} mg/dL` });
  const weight = m.match(/\b(\d{2,3}(?:\.\d)?)\s?(lb|lbs|pounds)\b/i);
  if (weight && /\b(weigh|weight|scale|down|lost)\b/i.test(m)) out.push({ category: "vitals", text: `Mentioned weight figure ${weight[1]} lb` });

  const symptoms: [RegExp, string][] = [
    [/\bnause\w*|queasy|throw\w* up|vomit\w*/i, "nausea/vomiting"],
    [/\bconstipat\w*/i, "constipation"],
    [/\bdiarrh\w*/i, "diarrhea"],
    [/\bheartburn|reflux\b/i, "heartburn/reflux"],
    [/\b(tired|fatigue\w*|exhausted)\b/i, "fatigue"],
    [/\bheadache\w*/i, "headaches"],
    [/\bbloat\w*/i, "bloating"],
  ];
  for (const [re, label] of symptoms) {
    if (re.test(m) && /\b(i|i'm|im|i've|my|been|having|feel|get)\b/i.test(m)) {
      const timing = m.match(/\b(after (my )?(shot|injection|dose)|in the morning|at night|every day|for (\w+ )?(days|weeks))\b/i);
      out.push({ category: "symptom", text: `Reports ${label}${timing ? ` ${timing[0].toLowerCase()}` : ""}` });
    }
  }
  const goal = m.match(/\bi (want|hope|would like) to ([^.!?]{4,80})/i);
  if (goal) out.push({ category: "goal", text: `Wants to ${goal[2].trim()}` });
  if (/\b(vegetarian|vegan|pescatarian|gluten[- ]free|lactose)\b/i.test(m)) {
    out.push({ category: "nutrition", text: `Dietary pattern: ${m.match(/\b(vegetarian|vegan|pescatarian|gluten[- ]free|lactose[- ]\w+)\b/i)![0].toLowerCase()}` });
  }
  if (/\b(night shift|travel\w* for work|no time|busy schedule|can'?t afford)\b/i.test(m)) {
    out.push({ category: "barrier", text: `Barrier mentioned: ${m.match(/\b(night shift|travel\w* for work|no time|busy schedule|can'?t afford)\b/i)![0].toLowerCase()}` });
  }
  const activity = m.match(/\b(walk\w*|run\w*|swim\w*|gym|yoga|lift\w*|bike|cycling)\b[^.!?]{0,40}/i);
  if (activity && /\b(i|i've|been|started)\b/i.test(m)) out.push({ category: "activity", text: `Activity: ${activity[0].trim().toLowerCase()}` });
  return out;
}
