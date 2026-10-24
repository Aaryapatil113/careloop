"use client";

import { useCallback, useEffect, useState } from "react";
import { ago, Card, CoachText, LevelBadge } from "@/components/ui";
import type { VisitSummary } from "@/lib/summary";
import type { ChatTurn, Escalation, MemoryFact, Patient } from "@/lib/types";

type Row = Patient & { openEscalations: number; memoryCount: number; lastMessageAt: string | null };
interface Detail {
  patient: Patient;
  turns: ChatTurn[];
  memory: MemoryFact[];
  escalations: Escalation[];
}

export default function ClinicianPortal() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pid, setPid] = useState<string>();
  const [detail, setDetail] = useState<Detail>();
  const [summary, setSummary] = useState<VisitSummary | { error: string }>();
  const [loadingSummary, setLoadingSummary] = useState(false);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/patients").then((r) => r.json());
    const sorted: Row[] = [...d.patients].sort((a: Row, b: Row) => b.openEscalations - a.openEscalations);
    setRows(sorted);
    setPid((cur) => cur ?? sorted[0]?.id);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!pid) return;
    setSummary(undefined);
    fetch(`/api/patients/${pid}`)
      .then((r) => r.json())
      .then(setDetail);
  }, [pid]);

  async function acknowledge(id: string) {
    await fetch("/api/escalations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDetail((d) => d && { ...d, escalations: d.escalations.map((e) => (e.id === id ? { ...e, status: "acknowledged" } : e)) });
    refresh();
  }

  async function generateSummary() {
    if (!pid) return;
    setLoadingSummary(true);
    try {
      setSummary(await fetch(`/api/patients/${pid}/summary`, { method: "POST" }).then((r) => r.json()));
    } finally {
      setLoadingSummary(false);
    }
  }

  const p = detail?.patient;
  const lost = p ? p.startWeightLb - p.currentWeightLb : 0;
  const superseded = new Set(detail?.memory.map((m) => m.supersedes).filter(Boolean));

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div>
        <h1 className="mb-3 text-lg font-semibold">Care team panel</h1>
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setPid(r.id)}
              className={`w-full rounded-xl border p-3 text-left ${pid === r.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                {r.openEscalations > 0 && (
                  <span className="rounded-full bg-red-600 px-2 text-xs font-semibold text-white">{r.openEscalations}</span>
                )}
              </div>
              <div className="text-xs text-slate-500">{r.medication}</div>
              <div className="mt-1 text-xs text-slate-500">
                {r.memoryCount} memory facts · {r.lastMessageAt ? `active ${ago(r.lastMessageAt)}` : "no messages"}
              </div>
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            await fetch("/api/reset", { method: "POST" });
            location.reload();
          }}
          className="mt-4 text-xs text-slate-500 underline"
        >
          Reset demo data
        </button>
      </div>

      {p && detail && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{p.name}</h2>
                <div className="text-sm text-slate-600">
                  {p.age} y · {p.medication} · started {new Date(p.startedOn).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-6 text-sm">
                <Stat label="Weight" value={`${p.currentWeightLb} lb`} />
                <Stat label="Change" value={`−${lost.toFixed(1)} lb`} sub={`${((lost / p.startWeightLb) * 100).toFixed(1)}%`} />
                <Stat label="Weeks" value={String(Math.round((Date.now() - Date.parse(p.startedOn)) / 604_800_000))} />
              </div>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Safety escalations</h3>
            </div>
            {detail.escalations.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {detail.escalations.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <LevelBadge level={e.level} />
                    <span className="min-w-0 flex-1">
                      <span className="text-slate-800">“{e.message}”</span>
                      <span className="block text-xs text-slate-500">
                        {e.reasons.join(", ")} · {ago(e.at)}
                      </span>
                    </span>
                    {e.status === "open" ? (
                      <button onClick={() => acknowledge(e.id)} className="rounded-md bg-slate-900 px-2.5 py-1 text-xs text-white">
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">✓ acknowledged</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Pre-visit brief</h3>
              <button
                onClick={generateSummary}
                disabled={loadingSummary}
                className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {loadingSummary ? "Generating…" : summary ? "Regenerate" : "Generate brief"}
              </button>
            </div>
            {!summary ? (
              <p className="text-sm text-slate-500">Summarizes between-visit memory, symptoms, and escalations into a one-glance brief.</p>
            ) : "error" in summary ? (
              <p className="text-sm text-red-700">{summary.error}</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-medium">{summary.headline}</p>
                <p className="text-slate-700">{summary.progress}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <List title="Symptoms" items={summary.symptoms} />
                  <List title="Safety events" items={summary.safety_events} />
                  <List title="Barriers" items={summary.barriers} />
                  <List title="Discussion points" items={summary.discussion_points} />
                </div>
                <p className="text-xs text-slate-400">Generated by {summary.generatedBy}. Verify before clinical use.</p>
              </div>
            )}
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <h3 className="mb-3 font-semibold">Longitudinal memory</h3>
              <ul className="space-y-2 text-sm">
                {[...detail.memory].reverse().map((m) => (
                  <li key={m.id} className={`flex gap-2 ${superseded.has(m.id) ? "opacity-40 line-through" : ""}`}>
                    <span className="h-fit shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-xs text-violet-700">{m.category}</span>
                    <span className="flex-1">{m.text}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {m.source === "conversation" ? "chat · " : ""}
                      {ago(m.at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-3 font-semibold">Recent conversation</h3>
              <div className="max-h-96 space-y-2 overflow-y-auto text-sm">
                {detail.turns.length === 0 && <p className="text-slate-500">No messages yet.</p>}
                {detail.turns.slice(-12).map((t) => (
                  <div key={t.id} className={t.role === "patient" ? "text-slate-900" : "border-l-2 border-teal-200 pl-2 text-slate-600"}>
                    <span className="mr-1 text-xs font-medium uppercase text-slate-400">{t.role}</span>
                    {t.role === "coach" ? <CoachText text={t.text} /> : t.text}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">
        {value} {sub && <span className="text-xs font-normal text-emerald-700">{sub}</span>}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
      {items.length ? (
        <ul className="list-disc space-y-0.5 pl-4 text-slate-700">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-400">None reported</p>
      )}
    </div>
  );
}
