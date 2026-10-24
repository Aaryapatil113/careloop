# CareLoop

**An AI care companion that extends GLP-1 obesity care between appointments.** A patient-facing coach and a clinician portal share one intelligence layer: grounded retrieval, longitudinal patient memory, deterministic safety triage, request tracing, and an eval suite that gates releases.

> Portfolio demo with fictional patients. Not medical advice. The knowledge-base content is illustrative and has not been clinically reviewed.

## What it does

| Area | Implementation |
|---|---|
| **AI patient coaching** | Streaming chat (NDJSON) grounded only in approved guidance. Answers cite guidance ids inline, and the coach abstains when nothing matches. |
| **Knowledge ingestion + retrieval** | Documents carry review metadata (`draft` → `published`); only published docs are chunked and indexed. BM25 retrieval adds a patient-language synonym map ("throwing up" → vomiting). |
| **Patient memory** | Each message goes through structured-output extraction (Zod schema) into typed facts: medication, symptom, nutrition, activity, goal, preference, barrier, vitals. Newer facts can supersede older ones, for example a dose change. |
| **Safety layer** | Deterministic triage runs **before** the model. *Emergency* skips the LLM and sends a fixed message. *Urgent* opens an escalation and tells the patient to contact their care team. *Scope* (dose changes, stopping medication) hands off to the prescriber. |
| **Output validation** | Every cited id is checked against what was actually retrieved. A mismatch is flagged on the trace. |
| **Clinician portal** | Escalation queue with acknowledge, a longitudinal memory timeline, the conversation view, and an LLM-generated pre-visit brief (structured output). |
| **Observability** | Per-request traces with a span waterfall (triage → retrieval → memory → generation → validation → memory write), plus tokens, latency, and safety level. |
| **Evals as release gates** | `npm run eval` checks emergency recall (must be 100%), triage accuracy, retrieval hit@3, out-of-scope abstention, and memory extraction. CI fails if any gate is missed. |

## Architecture

```
Patient app ──POST /api/chat──▶ runCoach() pipeline                          Clinician portal
                                 1. safety.triage   (rules, pre-model)  ──▶  escalations
                                 2. retrieval.bm25  (published KB only)
                                 3. memory.read     (longitudinal facts)
                                 4. llm.generate    (Claude, streamed, cites ids)
                                 5. validate        (citations ⊆ retrieved)
                                 6. memory.extract  (structured output)  ──▶  memory timeline
                                 └─ trace ─────────────────────────────────▶  /observability
```

- `src/lib/coach.ts`: orchestration pipeline and tracing
- `src/lib/safety.ts`: triage rules
- `src/lib/retrieval.ts`, `src/lib/knowledge.ts`: knowledge base and BM25
- `src/lib/memory.ts`: memory extraction (Claude structured outputs, or heuristics in demo mode)
- `src/lib/summary.ts`: clinician pre-visit brief
- `src/lib/evals.ts`, `scripts/eval.ts`: eval suite and CLI runner

## Live vs. demo mode

- **Live** (`ANTHROPIC_API_KEY` set): Claude (`claude-opus-5-5`) via the Anthropic TypeScript SDK. Uses streaming, prompt caching on the system prompt, server-side refusal fallbacks, and Zod structured outputs for memory and briefs.
- **Demo** (no key): a deterministic responder stitches approved guidance sentences together and personalizes them from memory. Every pipeline stage still runs and is traced, so the hosted demo costs nothing to run.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm run eval                 # offline eval gates
```

Deploy: import the repo into Vercel. It works with zero config in demo mode. State is in-memory and resets on cold start (the store sits behind a small interface so it can be swapped for Postgres).

## Known limitations / next steps

- Eval cases were written alongside the rules, so they are a development set. A held-out set and LLM-graded rubrics (groundedness, tone) for live mode are next.
- Lexical retrieval. Hybrid BM25 + embeddings would improve recall on paraphrases.
- In-memory store, no auth. Production would need Postgres, RBAC, audit logging, and HIPAA-grade infrastructure.
- FHIR/EHR integration (e.g. pulling medications and weights from an EHR) is not implemented.
