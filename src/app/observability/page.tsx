"use client";

import { Fragment, useEffect, useState } from "react";
import { ago, Card, LevelBadge } from "@/components/ui";
import type { Trace } from "@/lib/types";

export default function Observability() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [open, setOpen] = useState<string>();

  useEffect(() => {
    const load = () =>
      fetch("/api/traces")
        .then((r) => r.json())
        .then((d) => setTraces(d.traces));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  const n = traces.length;
  const p50 = n ? [...traces].sort((a, b) => a.latencyMs - b.latencyMs)[Math.floor(n / 2)].latencyMs : 0;
  const flagged = traces.filter((t) => t.safety.level !== "none").length;
  const abstained = traces.filter((t) => t.retrieved.length === 0 && t.safety.level === "none").length;
  const errors = traces.filter((t) => t.error).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Request traces</h1>
        <p className="text-sm text-slate-600">Every coach response is traced span-by-span: triage, retrieval, memory, generation, validation.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Requests" value={n} />
        <Metric label="p50 latency" value={`${p50} ms`} />
        <Metric label="Safety-flagged" value={n ? `${Math.round((flagged / n) * 100)}%` : "–"} />
        <Metric label="Abstained" value={abstained} />
        <Metric label="Errors / bad citations" value={errors} />
      </div>
      <Card className="overflow-x-auto p-0">
        {n === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No traces yet. Send a few messages in the <a href="/patient" className="text-teal-700 underline">patient app</a>.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Input</th>
                <th className="px-4 py-2">Triage</th>
                <th className="px-4 py-2">Sources</th>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2 text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => (
                <Fragment key={t.id}>
                  <tr onClick={() => setOpen(open === t.id ? undefined : t.id)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{ago(t.at)}</td>
                    <td className="max-w-xs truncate px-4 py-2">{t.input}</td>
                    <td className="px-4 py-2">
                      <LevelBadge level={t.safety.level} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-teal-700">{t.retrieved.map((r) => r.docId).join(", ") || "—"}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">{t.model}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{t.latencyMs} ms</td>
                  </tr>
                  {open === t.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        <Waterfall trace={t} />
                        <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                          {JSON.stringify(t, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Waterfall({ trace }: { trace: Trace }) {
  const total = Math.max(trace.latencyMs, 1);
  let offset = 0;
  return (
    <div className="space-y-1">
      {trace.spans.map((s) => {
        const left = (offset / total) * 100;
        offset += s.ms;
        return (
          <div key={s.name} className="grid grid-cols-[160px_1fr_60px] items-center gap-2 text-xs">
            <span className="font-mono text-slate-600">{s.name}</span>
            <div className="relative h-3 rounded bg-slate-200">
              <div className="absolute h-3 rounded bg-teal-600" style={{ left: `${left}%`, width: `${Math.max((s.ms / total) * 100, 0.5)}%` }} />
            </div>
            <span className="text-right tabular-nums text-slate-500">{s.ms} ms</span>
          </div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
