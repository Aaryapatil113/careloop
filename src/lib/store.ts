import type { ChatTurn, Escalation, MemoryFact, Patient, Trace } from "./types";

/**
 * In-memory store. Swappable for Postgres behind the same functions; kept
 * in-process so the demo deploys anywhere with zero infrastructure. State
 * resets when the server restarts. All patients are fictional.
 */
interface DB {
  patients: Patient[];
  turns: Map<string, ChatTurn[]>;
  memory: Map<string, MemoryFact[]>;
  escalations: Escalation[];
  traces: Trace[];
}

export const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function seed(): DB {
  const patients: Patient[] = [
    {
      id: "p_maya",
      name: "Maya Thompson",
      age: 42,
      medication: "Semaglutide 0.5 mg weekly",
      startedOn: daysAgo(63),
      startWeightLb: 228,
      currentWeightLb: 216.4,
      clinician: "Dr. R. Okafor",
    },
    {
      id: "p_daniel",
      name: "Daniel Reyes",
      age: 57,
      medication: "Tirzepatide 5 mg weekly",
      startedOn: daysAgo(35),
      startWeightLb: 262,
      currentWeightLb: 254.8,
      clinician: "Dr. R. Okafor",
    },
    {
      id: "p_priya",
      name: "Priya Nair",
      age: 35,
      medication: "Semaglutide 1 mg weekly",
      startedOn: daysAgo(140),
      startWeightLb: 196,
      currentWeightLb: 178.2,
      clinician: "L. Chen, RDN",
    },
  ];

  const fact = (category: MemoryFact["category"], text: string, d: number): MemoryFact => ({
    id: id("m"),
    category,
    text,
    at: daysAgo(d),
    source: "seed",
  });

  const memory = new Map<string, MemoryFact[]>([
    [
      "p_maya",
      [
        fact("medication", "Dose increased from 0.25 mg to 0.5 mg four weeks ago", 28),
        fact("symptom", "Moderate nausea for 2–3 days after each injection", 10),
        fact("nutrition", "Vegetarian; struggles to reach protein target", 21),
        fact("goal", "Wants to be able to hike with her kids this spring", 40),
        fact("preference", "Prefers short, practical tips over long explanations", 40),
      ],
    ],
    [
      "p_daniel",
      [
        fact("medication", "Also takes glipizide for type 2 diabetes", 35),
        fact("vitals", "Reported fasting glucose 92–110 mg/dL this week", 3),
        fact("activity", "Walks the dog 20 minutes most mornings", 14),
        fact("barrier", "Works night shifts; irregular meal timing", 30),
      ],
    ],
    [
      "p_priya",
      [
        fact("symptom", "Constipation improved after adding chia and more water", 12),
        fact("activity", "Strength training twice a week at home", 30),
        fact("goal", "Maintain muscle while losing weight", 90),
        fact("barrier", "Weight unchanged for 3 weeks; feeling discouraged", 4),
      ],
    ],
  ]);

  const turns = new Map<string, ChatTurn[]>([
    [
      "p_maya",
      [
        { id: id("t"), role: "patient", text: "The nausea is rough the day after my shot.", at: daysAgo(10) },
        {
          id: id("t"),
          role: "coach",
          text: "That's really common in the first weeks after a dose increase. Smaller meals, bland foods like crackers or toast, and sipping fluids between meals usually help. If you can't keep fluids down for more than a day, reach out to your care team.",
          at: daysAgo(10),
          citations: [{ docId: "nausea", title: "Managing nausea on GLP-1 therapy", snippet: "" }],
        },
      ],
    ],
    ["p_daniel", []],
    ["p_priya", []],
  ]);

  const escalations: Escalation[] = [
    {
      id: id("e"),
      patientId: "p_daniel",
      level: "urgent",
      reasons: ["Possible low blood sugar"],
      message: "Felt shaky and sweaty before lunch, glucose was 64",
      at: daysAgo(6),
      status: "acknowledged",
    },
  ];

  return { patients, turns, memory, escalations, traces: [] };
}

// Survive Next.js dev hot-reloads.
const g = globalThis as unknown as { __careloop?: DB };
export const db: DB = (g.__careloop ??= seed());

export const getPatient = (pid: string) => db.patients.find((p) => p.id === pid);
export const getTurns = (pid: string) => db.turns.get(pid) ?? [];
export const getMemory = (pid: string) => db.memory.get(pid) ?? [];

export function addTurn(pid: string, turn: ChatTurn) {
  db.turns.set(pid, [...getTurns(pid), turn]);
}

export function addMemory(pid: string, facts: MemoryFact[]) {
  db.memory.set(pid, [...getMemory(pid), ...facts]);
}

export function addEscalation(e: Escalation) {
  db.escalations.unshift(e);
}

export function addTrace(t: Trace) {
  db.traces.unshift(t);
  db.traces.length = Math.min(db.traces.length, 200);
}

export function resetDemo() {
  Object.assign(db, seed());
}
