import type Anthropic from "@anthropic-ai/sdk";
import { CHUNKS, KNOWLEDGE, type KnowledgeDoc } from "./knowledge";
import { anthropic, isLive, MODEL } from "./llm";
import { extractMemory } from "./memory";
import { retrieve, topDocs, type RetrievedChunk } from "./retrieval";
import { emergencyMessage, triage } from "./safety";
import { addEscalation, addMemory, addTrace, addTurn, getMemory, getPatient, getTurns, id } from "./store";
import type { Citation, MemoryFact, Patient, SafetyResult, Span, Trace } from "./types";

export type CoachEvent =
  | { type: "meta"; traceId: string; safety: SafetyResult; citations: Citation[] }
  | { type: "delta"; text: string }
  | { type: "replace"; text: string }
  | { type: "memory"; facts: MemoryFact[] }
  | { type: "done"; trace: Trace };

const SYSTEM = `You are CareLoop, an AI care companion that supports patients on GLP-1 therapy between clinic visits, on behalf of their care team.

Grounding rules:
- Answer ONLY from the care-team-approved guidance provided in <guidance>. Each guidance item has an id.
- Cite the guidance you used by putting its id in square brackets at the end of the sentence, e.g. "Try smaller meals. [nausea]". Only cite ids that appear in <guidance>.
- If the guidance does not cover the question, say you don't have approved guidance on that yet, and offer to pass the question to their care team. Do not fill gaps from general knowledge.

Safety rules:
- Never recommend starting, stopping, or changing the dose of any medication. Dose decisions belong to the prescriber.
- Never diagnose. If <triage> says urgent, clearly tell the patient to contact their care team today and that the team has been notified.
- You are not a substitute for medical care.

Personalization:
- Use <patient_memory> to tailor advice (diet, goals, barriers, coaching preferences) and to connect to things the patient told you before. Mention a past detail only when it is relevant.

Style: warm, plain language, 3 to 6 short sentences or a brief list. No headings. Speak directly to the patient.`;

function guidanceBlock(chunks: RetrievedChunk[]): string {
  const byDoc = new Map<string, string[]>();
  for (const c of chunks) byDoc.set(c.docId, [...(byDoc.get(c.docId) ?? []), c.text]);
  // Include the full doc for the top match so the model has complete context.
  const top = chunks[0] && KNOWLEDGE.find((d) => d.id === chunks[0].docId);
  if (top) byDoc.set(top.id, top.body.split("\n"));
  return [...byDoc.entries()]
    .map(([docId, lines]) => `<item id="${docId}" title="${KNOWLEDGE.find((d) => d.id === docId)?.title}">\n${lines.join("\n")}\n</item>`)
    .join("\n");
}

function contextBlock(patient: Patient, memory: MemoryFact[], chunks: RetrievedChunk[], safety: SafetyResult, message: string) {
  const live = memory.filter((f) => !memory.some((o) => o.supersedes === f.id));
  return `<patient_profile>
Name: ${patient.name.split(" ")[0]}; Age: ${patient.age}; Medication: ${patient.medication}; Weeks on therapy: ${Math.round((Date.now() - Date.parse(patient.startedOn)) / 604_800_000)}
</patient_profile>
<patient_memory>
${live.map((f) => `- [${f.category}, ${f.at.slice(0, 10)}] ${f.text}`).join("\n") || "(none yet)"}
</patient_memory>
<guidance>
${guidanceBlock(chunks) || "(no approved guidance matched this question)"}
</guidance>
<triage level="${safety.level}">${safety.reasons.join("; ")}</triage>

Patient message: ${message}`;
}

export async function* runCoach(patientId: string, message: string): AsyncGenerator<CoachEvent> {
  const patient = getPatient(patientId);
  if (!patient) throw new Error(`Unknown patient ${patientId}`);
  const live = isLive();
  const t0 = Date.now();
  const spans: Span[] = [];
  const span = async <T>(name: string, fn: () => T | Promise<T>, meta?: (r: T) => Record<string, unknown>) => {
    const s = Date.now();
    const r = await fn();
    spans.push({ name, ms: Date.now() - s, meta: meta?.(r) });
    return r;
  };

  const traceId = id("tr");
  addTurn(patientId, { id: id("t"), role: "patient", text: message, at: new Date().toISOString() });

  // 1. Safety triage — deterministic, before any model call.
  const safety = await span("safety.triage", () => triage(message), (r) => ({ level: r.level, rules: r.ruleIds }));

  // 2. Retrieval + memory read.
  const chunks = await span(
    "retrieval.bm25",
    () => {
      const hits = retrieve(message);
      // Policy-pinned guidance: prescriber-scope questions always get the dose policy doc.
      if (safety.level === "scope" && !hits.some((h) => h.docId === "dose-escalation")) {
        hits.unshift(...CHUNKS.filter((c) => c.docId === "dose-escalation").slice(0, 2).map((c) => ({ ...c, score: 99 })));
      }
      return hits;
    },
    (r) => ({ hits: r.length, top: r[0]?.id }),
  );
  const memory = await span("memory.read", () => getMemory(patientId), (r) => ({ facts: r.length }));
  const docs = topDocs(chunks);
  const citations: Citation[] = docs.map((d) => ({
    docId: d.docId,
    title: d.title,
    snippet: chunks.find((c) => c.docId === d.docId)!.text,
  }));

  if (safety.level !== "none") {
    addEscalation({
      id: id("e"),
      patientId,
      level: safety.level,
      reasons: safety.reasons,
      message,
      at: new Date().toISOString(),
      status: "open",
    });
  }

  yield { type: "meta", traceId, safety, citations: safety.level === "emergency" ? [] : citations };

  // 3. Generation.
  let output = "";
  let usage: Trace["usage"];
  let error: string | undefined;
  const genStart = Date.now();
  try {
    if (safety.level === "emergency") {
      output = emergencyMessage(safety);
      yield { type: "delta", text: output };
    } else if (live) {
      const history: Anthropic.Beta.BetaMessageParam[] = getTurns(patientId)
        .slice(-9, -1)
        .map((t) => ({ role: t.role === "patient" ? "user" : "assistant", content: t.text }));
      // The API requires the first message to be from the user.
      while (history[0]?.role === "assistant") history.shift();
      const stream = anthropic().beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [...history, { role: "user", content: contextBlock(patient, memory, chunks, safety, message) }],
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          output += event.delta.text;
          yield { type: "delta", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      usage = {
        input: final.usage.input_tokens,
        output: final.usage.output_tokens,
        cacheRead: final.usage.cache_read_input_tokens ?? 0,
      };
      if (final.stop_reason === "refusal") {
        output = "I'm not able to help with that one here. I've noted your question so your care team can follow up.";
        yield { type: "replace", text: output };
      }
    } else {
      output = demoResponse(patient, memory, chunks, safety);
      for (const word of output.split(/(?<= )/)) {
        yield { type: "delta", text: word };
        await new Promise((r) => setTimeout(r, 12));
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    output = "Sorry, I'm having trouble responding right now. If this is urgent, please contact your care team directly.";
    yield { type: "replace", text: output };
  }
  spans.push({ name: live && safety.level !== "emergency" ? "llm.generate" : "responder.template", ms: Date.now() - genStart, meta: { chars: output.length } });

  // 4. Output validation: every cited id must be one we actually retrieved.
  const cited = [...output.matchAll(/\[([a-z0-9-]+)\]/g)].map((m) => m[1]);
  const allowed = new Set(docs.map((d) => d.docId));
  const invalid = cited.filter((c) => !allowed.has(c));
  spans.push({ name: "validate.citations", ms: 0, meta: { cited: [...new Set(cited)], invalid } });

  // 5. Memory write.
  const facts = await span(
    "memory.extract",
    () => (safety.level === "emergency" ? [] : extractMemory(message, memory)),
    (r) => ({ added: r.length }),
  ).catch(() => [] as MemoryFact[]);
  if (facts.length) {
    addMemory(patientId, facts);
    yield { type: "memory", facts };
  }

  addTurn(patientId, {
    id: id("t"),
    role: "coach",
    text: output,
    at: new Date().toISOString(),
    citations: citations.filter((c) => cited.includes(c.docId)),
    safety,
    traceId,
  });

  const trace: Trace = {
    id: traceId,
    patientId,
    at: new Date(t0).toISOString(),
    mode: live ? "live" : "demo",
    model: live ? MODEL : "template-responder",
    input: message,
    output,
    latencyMs: Date.now() - t0,
    spans,
    safety,
    retrieved: docs.map((d) => ({ docId: d.docId, score: Number(d.score.toFixed(2)) })),
    usage,
    memoryAdded: facts.length,
    error: error ?? (invalid.length ? `Uncited/unknown ids: ${invalid.join(", ")}` : undefined),
  };
  addTrace(trace);
  yield { type: "done", trace };
}

const MEMORY_FOR_TOPIC: Record<KnowledgeDoc["category"], MemoryFact["category"][]> = {
  "side-effects": ["symptom"],
  nutrition: ["nutrition"],
  activity: ["activity", "goal"],
  medication: [],
  safety: [],
  lifestyle: ["barrier"],
};

/** Demo-mode responder: stitches approved guidance sentences, personalized from memory. */
export function demoResponse(patient: Patient, memory: MemoryFact[], chunks: RetrievedChunk[], safety: SafetyResult): string {
  const first = patient.name.split(" ")[0];
  if (safety.level === "scope") {
    return `Good question, ${first}. Changes to your medication or dose are a decision for your prescriber, so I don't want to steer you on that myself. [dose-escalation] I've sent your question to your care team so they can follow up. In the meantime, keep taking your medication as prescribed and jot down any side effects and when they happen, which helps them decide. [dose-escalation]`;
  }
  if (chunks.length === 0) {
    return `I don't have care-team-approved guidance on that yet, ${first}, so I'd rather not guess. I've noted your question so your care team can answer it at your next check-in.`;
  }
  const topDoc = chunks[0].docId;
  const doc = KNOWLEDGE.find((d) => d.id === topDoc)!;
  const lines = doc.body.split("\n");
  // Matched sentences from the top doc, padded with its opening lines, kept in document order.
  const matched = chunks.filter((c) => c.docId === topDoc).map((c) => c.text);
  const picked = [...new Set([...matched, ...lines.slice(1, 3)])]
    .slice(0, 3)
    .sort((a, b) => lines.indexOf(a) - lines.indexOf(b));
  const second = chunks.find((c) => c.docId !== topDoc && c.score > chunks[0].score * 0.8);

  const relevantMemory = memory.filter((f) => MEMORY_FOR_TOPIC[doc.category].includes(f.category)).at(-1);

  const parts = [
    relevantMemory ? `Thanks for checking in, ${first}. Keeping in mind what you've shared before (${relevantMemory.text.charAt(0).toLowerCase()}${relevantMemory.text.slice(1)}), here's what your care team's guidance suggests.` : `Thanks for asking, ${first}.`,
    ...picked.map((s) => `${s} [${topDoc}]`),
  ];
  if (second) parts.push(`${second.text} [${second.docId}]`);
  if (safety.level === "urgent") {
    parts.push("Because of what you described, please contact your care team today. I've already flagged this for them.");
  }
  return parts.join(" ");
}
