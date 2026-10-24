import type { SafetyResult, TriageLevel } from "./types";

/**
 * Deterministic pre-model triage. Runs on every patient message BEFORE the LLM.
 *
 * - emergency: the model is bypassed entirely; a fixed, reviewed message is sent
 *   and the care team is alerted.
 * - urgent: the model may still answer, but must tell the patient to contact
 *   their care team, and an escalation is opened.
 * - scope: questions the coach must not answer on its own (dose changes, stopping
 *   medication) — answered with a hand-off to the prescriber.
 *
 * Rules are intentionally conservative: a false positive costs a clinician a
 * glance; a false negative can cost much more.
 */
interface Rule {
  id: string;
  level: Exclude<TriageLevel, "none">;
  reason: string;
  /** All groups must match (AND); each group is an OR of patterns. */
  all: RegExp[];
  none?: RegExp[];
}

const RULES: Rule[] = [
  {
    id: "self-harm",
    level: "emergency",
    reason: "Possible thoughts of self-harm",
    all: [/\b(kill myself|end my life|suicid|self[- ]harm|hurt myself|don'?t want to (live|be alive)|better off dead)\b/i],
  },
  {
    id: "anaphylaxis",
    level: "emergency",
    reason: "Possible severe allergic reaction",
    all: [/\b(throat|tongue|lips?|face)\b.*\b(swell|swollen|closing)|\b(swell|swollen|closing)\b.*\b(throat|tongue|lips?|face)\b|can'?t breathe|trouble breathing|hard to breathe/i],
  },
  {
    id: "pancreatitis",
    level: "emergency",
    reason: "Severe abdominal pain (possible pancreatitis)",
    all: [
      /\b(severe|intense|unbearable|worst|sharp|stabbing|excruciating|really bad)\b/i,
      /\b(stomach|abdomen|abdominal|belly|gut)\b.*\b(pain|hurts?|ache)|\b(pain|hurts?|ache)\b.*\b(stomach|abdomen|abdominal|belly|back)\b/i,
    ],
  },
  {
    id: "pain-to-back",
    level: "emergency",
    reason: "Abdominal pain radiating to the back (possible pancreatitis)",
    all: [/\b(stomach|abdomen|abdominal|belly)\b/i, /\b(radiat\w*|spread\w*|goes|going|shoot\w*)\b.*\bback\b/i],
  },
  {
    id: "gallbladder",
    level: "urgent",
    reason: "Possible gallbladder symptoms",
    all: [/\b(yellow\w* (skin|eyes)|(skin|eyes)\b.{0,20}\byellow|jaundice|upper right (side|abdomen|belly)|right upper (side|abdomen|belly))\b/i],
  },
  {
    id: "persistent-vomiting",
    level: "urgent",
    reason: "Unable to keep food or fluids down",
    all: [/\b(can'?t|cannot|unable to|not able to) (keep|hold) (any |my )?(anything|food|fluids|water|liquids)( down)?\b|\bvomit\w* (all day|for (two|2|three|3) days|nonstop|constantly)\b|\bthrowing up (all day|constantly|nonstop|everything)\b/i],
  },
  {
    id: "dehydration",
    level: "urgent",
    reason: "Signs of dehydration",
    all: [/\b(dizzy|lightheaded|light-headed|faint)\b/i, /\b(not (peeing|urinating)|barely (peeing|urinating)|dark (urine|pee)|haven'?t (peed|urinated)|dehydrat\w*|can'?t keep)\b/i],
  },
  {
    id: "hypoglycemia",
    level: "urgent",
    reason: "Possible low blood sugar",
    all: [/\b(blood sugar|glucose|bg|sugar)\b.*\b([1-6]\d)\b|\b([1-6]\d)\b.*\b(mg\/dl|blood sugar|glucose)\b|\b(shaky|shaking|sweaty)\b.*\b(insulin|glipizide|glyburide|glimepiride|sulfonylurea)\b/i],
  },
  {
    id: "neck-lump",
    level: "urgent",
    reason: "Neck lump or swallowing change",
    all: [/\b(lump|mass|swelling) (in|on) (my )?neck\b|\btrouble swallowing\b|\bhoarse\w* (for|that won'?t)\b/i],
  },
  {
    id: "pregnancy",
    level: "urgent",
    reason: "Pregnancy or planning pregnancy",
    all: [/\b(i'?m pregnant|i am pregnant|might be pregnant|positive pregnancy|trying to (get pregnant|conceive))\b/i],
  },
  {
    id: "dose-change",
    level: "scope",
    reason: "Asked about changing dose (prescriber decision)",
    all: [
      /\b(increase|raise|up|double|lower|decrease|reduce|change|adjust|skip|split|go up|bump)\b/i,
      /\b(dose|dosage|mg|shot|injection|ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide)\b/i,
    ],
    none: [/\b(miss(ed)?|forgot)\b/i],
  },
  {
    id: "double-dose",
    level: "scope",
    reason: "Asked about doubling or catching up a dose (prescriber decision)",
    all: [/\b(double|two|2|extra|make up)\b.{0,20}\b(dose|doses|shots?|injections?)\b/i],
  },
  {
    id: "stop-medication",
    level: "scope",
    reason: "Asked about stopping medication (prescriber decision)",
    all: [/\b(stop|quit|come off|get off|discontinue)\b.*\b(medication|meds|shots?|injections?|ozempic|wegovy|mounjaro|zepbound|semaglutide|tirzepatide|glp)\b/i],
  },
];

const RANK: Record<TriageLevel, number> = { none: 0, scope: 1, urgent: 2, emergency: 3 };

export function triage(message: string): SafetyResult {
  const hits = RULES.filter((r) => r.all.every((re) => re.test(message)) && !(r.none ?? []).some((re) => re.test(message)));
  const level = hits.reduce<TriageLevel>((lvl, r) => (RANK[r.level] > RANK[lvl] ? r.level : lvl), "none");
  return { level, ruleIds: hits.map((r) => r.id), reasons: hits.map((r) => r.reason) };
}

export const EMERGENCY_MESSAGE: Record<string, string> = {
  "self-harm":
    "I'm really glad you told me. You deserve support right now. Please call or text **988** (Suicide & Crisis Lifeline) or call **911** if you are in immediate danger. I've also alerted your care team so they can reach out to you.",
  default:
    "What you're describing could need urgent medical attention. **Please call 911 or go to the nearest emergency room now.** Don't wait to see if it improves. I've alerted your care team, and they will follow up with you.",
};

export function emergencyMessage(result: SafetyResult): string {
  return result.ruleIds.includes("self-harm") ? EMERGENCY_MESSAGE["self-harm"] : EMERGENCY_MESSAGE.default;
}
