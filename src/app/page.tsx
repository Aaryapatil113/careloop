import Link from "next/link";
import { Card } from "@/components/ui";

const PIPELINE = [
  { name: "Safety triage", detail: "Deterministic rules run before any model call. Emergencies bypass the LLM entirely." },
  { name: "Retrieval", detail: "BM25 over a clinician-reviewed knowledge base, with patient-language synonym expansion." },
  { name: "Memory read", detail: "Longitudinal facts (doses, symptoms, goals, barriers) personalize every answer." },
  { name: "Generation", detail: "Claude streams a grounded answer that cites guidance ids. Abstains if nothing matches." },
  { name: "Validation", detail: "Every citation is checked against what was actually retrieved." },
  { name: "Memory write", detail: "Structured-output extraction adds new durable facts; newer facts supersede old ones." },
];

const FEATURES = [
  {
    title: "AI patient coaching",
    body: "Streaming chat grounded only in approved guidance, with inline citations and personalization from patient memory.",
    href: "/patient",
  },
  {
    title: "Patient memory",
    body: "Facts extracted from conversation into a typed, longitudinal record that clinicians can read and the coach can use.",
    href: "/clinician",
  },
  {
    title: "Clinician workflow",
    body: "Escalation queue with acknowledgement, a memory timeline, and an LLM-generated pre-visit brief.",
    href: "/clinician",
  },
  {
    title: "Observability",
    body: "Per-request traces with a span waterfall, token usage, safety level, sources, and citation-validation errors.",
    href: "/observability",
  },
  {
    title: "Evals as release gates",
    body: "Emergency recall, triage accuracy, retrieval hit@3, abstention, and memory extraction, run in CI.",
    href: "/evals",
  },
  {
    title: "Runs anywhere",
    body: "Live mode uses Claude via the Anthropic SDK. Without a key, a deterministic responder keeps the hosted demo free.",
  },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="pt-6">
        <p className="mb-2 text-sm font-medium text-teal-700">Full-stack AI · Clinical systems demo</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          An AI care companion that extends GLP-1 obesity care between appointments.
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          CareLoop pairs a patient-facing coach with clinician tools. Answers are grounded in reviewed guidance, personalized by
          longitudinal memory, gated by safety triage, and fully traced and evaluated.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/patient" className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Open patient app →
          </Link>
          <Link href="/clinician" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:border-slate-400">
            Open clinician portal
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Request pipeline</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {PIPELINE.map((s, i) => (
            <li key={s.name} className="relative rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-700 text-[11px] font-medium text-white">{i + 1}</span>
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">{s.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const card = (
            <Card className="h-full transition hover:border-teal-600">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.body}</p>
            </Card>
          );
          return f.href ? (
            <Link key={f.title} href={f.href}>
              {card}
            </Link>
          ) : (
            <div key={f.title}>{card}</div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Stack</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {["Next.js 15 (App Router)", "TypeScript", "React 19", "Tailwind CSS", "Anthropic SDK · Claude", "Zod structured outputs", "NDJSON streaming", "BM25 retrieval", "tsx eval runner"].map((t) => (
            <span key={t} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-700">
              {t}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
