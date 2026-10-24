export type Role = "patient" | "coach";

export interface ChatTurn {
  id: string;
  role: Role;
  text: string;
  at: string;
  citations?: Citation[];
  safety?: SafetyResult;
  traceId?: string;
}

export interface Citation {
  docId: string;
  title: string;
  snippet: string;
}

export type MemoryCategory =
  | "medication"
  | "symptom"
  | "nutrition"
  | "activity"
  | "goal"
  | "preference"
  | "barrier"
  | "vitals";

export interface MemoryFact {
  id: string;
  category: MemoryCategory;
  text: string;
  at: string;
  source: "seed" | "conversation";
  /** Newer facts can supersede older ones in the same category (e.g. a dose change). */
  supersedes?: string;
}

export type TriageLevel = "none" | "scope" | "urgent" | "emergency";

export interface SafetyResult {
  level: TriageLevel;
  ruleIds: string[];
  reasons: string[];
}

export interface Escalation {
  id: string;
  patientId: string;
  level: Exclude<TriageLevel, "none">;
  reasons: string[];
  message: string;
  at: string;
  status: "open" | "acknowledged";
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  medication: string;
  startedOn: string;
  startWeightLb: number;
  currentWeightLb: number;
  clinician: string;
}

export interface Span {
  name: string;
  ms: number;
  meta?: Record<string, unknown>;
}

export interface Trace {
  id: string;
  patientId: string;
  at: string;
  mode: "live" | "demo";
  model: string;
  input: string;
  output: string;
  latencyMs: number;
  spans: Span[];
  safety: SafetyResult;
  retrieved: { docId: string; score: number }[];
  usage?: { input: number; output: number; cacheRead: number };
  memoryAdded: number;
  error?: string;
}
