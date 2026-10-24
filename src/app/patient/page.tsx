"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CoachText, LevelBadge } from "@/components/ui";
import type { ChatTurn, Citation, MemoryFact, Patient, SafetyResult, Trace } from "@/lib/types";

const SUGGESTIONS = [
  "I've been really nauseous the day after my shot. Any tips?",
  "How can I get more protein? I'm vegetarian.",
  "Can I go up to 1 mg this week? 0.5 isn't doing much",
  "The scale hasn't moved in 3 weeks and I'm discouraged",
  "I have severe stomach pain that goes through to my back",
  "What's a good laptop for school?",
];

interface Inspect {
  safety?: SafetyResult;
  citations?: Citation[];
  memory?: MemoryFact[];
  trace?: Trace;
}

export default function PatientApp() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pid, setPid] = useState("p_maya");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState<Inspect>({});
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/patients")
      .then((r) => r.json())
      .then((d) => setPatients(d.patients));
  }, []);

  const load = useCallback(async (id: string) => {
    const d = await fetch(`/api/patients/${id}`).then((r) => r.json());
    setTurns(d.turns);
    setInspect({});
  }, []);
  useEffect(() => {
    load(pid);
  }, [pid, load]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setInput("");
    const coachId = `pending_${Date.now()}`;
    setTurns((t) => [
      ...t,
      { id: `u_${Date.now()}`, role: "patient", text, at: new Date().toISOString() },
      { id: coachId, role: "coach", text: "", at: new Date().toISOString() },
    ]);
    setInspect({});
    const update = (fn: (t: ChatTurn) => ChatTurn) => setTurns((ts) => ts.map((t) => (t.id === coachId ? fn(t) : t)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: pid, message: text }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const ev = JSON.parse(line);
          if (ev.type === "meta") {
            update((t) => ({ ...t, safety: ev.safety, citations: ev.citations }));
            setInspect({ safety: ev.safety, citations: ev.citations });
          } else if (ev.type === "delta") update((t) => ({ ...t, text: t.text + ev.text }));
          else if (ev.type === "replace") update((t) => ({ ...t, text: ev.text }));
          else if (ev.type === "memory") setInspect((i) => ({ ...i, memory: ev.facts }));
          else if (ev.type === "done") setInspect((i) => ({ ...i, trace: ev.trace }));
          else if (ev.type === "error") update((t) => ({ ...t, text: "Something went wrong. Please try again." }));
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const patient = patients.find((p) => p.id === pid);

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <div>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <label htmlFor="patient" className="text-slate-600">
            Signed in as
          </label>
          <select
            id="patient"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Phone frame */}
        <div className="mx-auto flex h-[680px] max-w-[400px] flex-col overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-white shadow-xl">
          <div className="bg-teal-700 px-4 pb-3 pt-4 text-white">
            <div className="text-xs opacity-80">Your care companion</div>
            <div className="font-semibold">Hi {patient?.name.split(" ")[0] ?? ""} 👋</div>
            <div className="text-xs opacity-80">{patient?.medication}</div>
          </div>
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {turns.length === 0 && (
              <p className="mt-8 text-center text-sm text-slate-500">Ask anything about your treatment, side effects, food, or activity.</p>
            )}
            {turns.map((t) => (
              <div key={t.id} className={`flex ${t.role === "patient" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    t.role === "patient"
                      ? "rounded-br-sm bg-teal-700 text-white"
                      : t.safety?.level === "emergency"
                        ? "rounded-bl-sm border border-red-300 bg-red-50 text-red-900"
                        : "rounded-bl-sm border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {t.role === "coach" ? (
                    t.text ? <CoachText text={t.text} /> : <span className="animate-pulse text-slate-400">Thinking…</span>
                  ) : (
                    t.text
                  )}
                  {t.role === "coach" && t.safety && t.safety.level !== "none" && (
                    <div className="mt-1.5 text-[11px] text-slate-500">✓ Your care team has been notified</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 border-t border-slate-200 p-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message your care companion…"
              aria-label="Message"
              className="flex-1 rounded-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            />
            <button disabled={busy || !input.trim()} className="rounded-full bg-teal-700 px-4 text-sm font-medium text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Try a scenario</h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:border-teal-600 hover:text-teal-800 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Under the hood · last response</h2>
          {!inspect.safety ? (
            <p className="text-sm text-slate-500">Send a message to see each pipeline stage: safety triage → retrieval → generation → citation check → memory write.</p>
          ) : (
            <ol className="space-y-4 text-sm">
              <Stage n={1} title="Safety triage (deterministic, pre-model)">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge level={inspect.safety.level} />
                  {inspect.safety.reasons.map((r) => (
                    <span key={r} className="text-slate-600">
                      {r}
                    </span>
                  ))}
                </div>
                {inspect.safety.level === "emergency" && <p className="mt-1 text-xs text-red-700">Model bypassed. Fixed escalation message sent and care team alerted.</p>}
              </Stage>
              <Stage n={2} title="Retrieved approved guidance">
                {inspect.citations?.length ? (
                  <ul className="space-y-1">
                    {inspect.citations.map((c) => (
                      <li key={c.docId}>
                        <span className="font-mono text-xs text-teal-700">[{c.docId}]</span> {c.title}
                        <div className="text-xs text-slate-500">“{c.snippet}”</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">No guidance matched, so the coach abstains instead of guessing.</span>
                )}
              </Stage>
              <Stage n={3} title="Memory updates">
                {inspect.memory?.length ? (
                  <ul className="space-y-1">
                    {inspect.memory.map((m) => (
                      <li key={m.id}>
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">{m.category}</span> {m.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-500">{inspect.trace ? "No new durable facts." : "…"}</span>
                )}
              </Stage>
              <Stage n={4} title="Trace">
                {inspect.trace ? (
                  <div className="space-y-1">
                    <div className="text-slate-600">
                      {inspect.trace.model} · {inspect.trace.latencyMs} ms
                      {inspect.trace.usage && ` · ${inspect.trace.usage.input} in / ${inspect.trace.usage.output} out tokens`}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {inspect.trace.spans.map((s) => (
                        <span key={s.name} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                          {s.name} {s.ms}ms
                        </span>
                      ))}
                    </div>
                    {inspect.trace.error && <div className="text-xs text-red-700">{inspect.trace.error}</div>}
                  </div>
                ) : (
                  <span className="text-slate-500">…</span>
                )}
              </Stage>
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stage({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-teal-700 text-xs font-medium text-white">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-medium text-slate-800">{title}</div>
        {children}
      </div>
    </li>
  );
}
