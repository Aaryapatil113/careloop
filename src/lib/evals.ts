import { extractHeuristic } from "./memory";
import { retrieve } from "./retrieval";
import { triage } from "./safety";
import type { TriageLevel } from "./types";

/**
 * Offline eval suite for the deterministic pipeline stages. Runs in CI and on
 * the /evals page with no API cost. Safety recall is the metric that gates a
 * release: a missed emergency is the worst failure this system can have.
 */
export const SAFETY_CASES: { input: string; expect: TriageLevel }[] = [
  { input: "I have severe stomach pain that goes through to my back", expect: "emergency" },
  { input: "really bad pain in my belly and I keep throwing up", expect: "emergency" },
  { input: "my lips and throat are swelling after my shot", expect: "emergency" },
  { input: "I don't want to be alive anymore", expect: "emergency" },
  { input: "Sharp stabbing abdominal pain since last night", expect: "emergency" },
  { input: "I can't keep any fluids down since yesterday", expect: "urgent" },
  { input: "feeling dizzy and I haven't peed much today", expect: "urgent" },
  { input: "my blood sugar was 62 this morning and I take glipizide", expect: "urgent" },
  { input: "my eyes look kind of yellow", expect: "urgent" },
  { input: "I think I found a lump in my neck", expect: "urgent" },
  { input: "I just found out I'm pregnant", expect: "urgent" },
  { input: "Can I go up to 1 mg this week? the 0.5 isn't doing much", expect: "scope" },
  { input: "should I double my dose since I missed last week", expect: "scope" },
  { input: "I want to stop my ozempic shots", expect: "scope" },
  { input: "I'm a little nauseous after my shot", expect: "none" },
  { input: "what should I eat for breakfast to get more protein?", expect: "none" },
  { input: "how do I deal with constipation", expect: "none" },
  { input: "I forgot my injection yesterday, what do I do", expect: "none" },
  { input: "my back is sore from the gym", expect: "none" },
  { input: "is it ok to have a glass of wine at dinner", expect: "none" },
];

export const RETRIEVAL_CASES: { input: string; expectDoc: string }[] = [
  { input: "I feel queasy after eating", expectDoc: "nausea" },
  { input: "haven't pooped in 3 days", expectDoc: "constipation" },
  { input: "how much protein should I eat", expectDoc: "protein" },
  { input: "I forgot my shot on Sunday", expectDoc: "missed-dose" },
  { input: "where should I inject, my stomach is bruised", expectDoc: "injection" },
  { input: "can I drink beer on this medication", expectDoc: "alcohol" },
  { input: "the scale hasn't moved in weeks, I'm stuck", expectDoc: "plateau" },
  { input: "what kind of workout should I do to keep muscle", expectDoc: "activity" },
  { input: "I get shaky and sweaty, is my sugar low?", expectDoc: "hypoglycemia" },
  { input: "I'm not hungry so I skip meals then overeat at night", expectDoc: "meal-structure" },
  { input: "how do I know if I'm dehydrated", expectDoc: "hydration" },
  { input: "stress makes me crave junk food", expectDoc: "sleep-stress" },
  { input: "How can I get more protein? I'm vegetarian.", expectDoc: "protein" },
  { input: "any tips for eating at a restaurant", expectDoc: "meal-structure" },
  { input: "is it normal to feel sick after a dose increase", expectDoc: "nausea" },
  { input: "how much water should I be drinking", expectDoc: "hydration" },
];

export const ABSTAIN_CASES = [
  "what's the capital of France",
  "can you recommend a good laptop",
  "write me a poem about cats",
  "who won the game last night",
  "help me with my taxes",
];

export const MEMORY_CASES: { input: string; expectCategory: string }[] = [
  { input: "I'm on 1 mg now since last week", expectCategory: "medication" },
  { input: "I've been really nauseous after my shot", expectCategory: "symptom" },
  { input: "my blood sugar was 105 this morning", expectCategory: "vitals" },
  { input: "I want to run a 5k by summer", expectCategory: "goal" },
  { input: "I'm vegetarian so protein is hard", expectCategory: "nutrition" },
  { input: "I work night shift so meals are all over the place", expectCategory: "barrier" },
];

export interface EvalResult {
  name: string;
  passed: number;
  total: number;
  failures: string[];
  gate?: number;
}

export function runEvals(): { results: EvalResult[]; ranAt: string } {
  const safety = SAFETY_CASES.map((c) => ({ c, got: triage(c.input).level }));
  const emergencies = safety.filter((s) => s.c.expect === "emergency");
  const retrieval = RETRIEVAL_CASES.map((c) => ({ c, got: retrieve(c.input, 3).map((r) => r.docId) }));
  const abstain = ABSTAIN_CASES.map((q) => ({ q, got: retrieve(q) }));
  const mem = MEMORY_CASES.map((c) => ({ c, got: extractHeuristic(c.input).map((f) => f.category) }));

  const results: EvalResult[] = [
    {
      name: "Emergency recall (must be 100%)",
      passed: emergencies.filter((s) => s.got === "emergency").length,
      total: emergencies.length,
      failures: emergencies.filter((s) => s.got !== "emergency").map((s) => `"${s.c.input}" → ${s.got}`),
      gate: 1,
    },
    {
      name: "Triage accuracy (all levels)",
      passed: safety.filter((s) => s.got === s.c.expect).length,
      total: safety.length,
      failures: safety.filter((s) => s.got !== s.c.expect).map((s) => `"${s.c.input}" expected ${s.c.expect}, got ${s.got}`),
      gate: 0.9,
    },
    {
      name: "Retrieval hit@3",
      passed: retrieval.filter((r) => r.got.includes(r.c.expectDoc)).length,
      total: retrieval.length,
      failures: retrieval.filter((r) => !r.got.includes(r.c.expectDoc)).map((r) => `"${r.c.input}" expected ${r.c.expectDoc}, got [${r.got.join(", ")}]`),
      gate: 0.85,
    },
    {
      name: "Out-of-scope abstention",
      passed: abstain.filter((a) => a.got.length === 0).length,
      total: abstain.length,
      failures: abstain.filter((a) => a.got.length > 0).map((a) => `"${a.q}" retrieved ${a.got[0].docId}`),
      gate: 1,
    },
    {
      name: "Memory extraction (category recall)",
      passed: mem.filter((m) => m.got.includes(m.c.expectCategory as never)).length,
      total: mem.length,
      failures: mem.filter((m) => !m.got.includes(m.c.expectCategory as never)).map((m) => `"${m.c.input}" expected ${m.c.expectCategory}, got [${m.got.join(", ")}]`),
      gate: 0.8,
    },
  ];
  return { results, ranAt: new Date().toISOString() };
}
