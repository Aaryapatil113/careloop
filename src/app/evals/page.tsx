"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import type { EvalResult } from "@/lib/evals";

export default function Evals() {
  const [data, setData] = useState<{ results: EvalResult[]; ranAt: string }>();
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      setData(await fetch("/api/evals").then((r) => r.json()));
    } finally {
      setRunning(false);
    }
  }
  useEffect(() => {
    run();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Offline eval suite</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Release gates for the deterministic pipeline stages. The same suite runs in CI with <code className="rounded bg-slate-100 px-1">npm run eval</code>{" "}
            and fails the build if any gate is missed. Emergency recall must be 100%.
          </p>
        </div>
        <button onClick={run} disabled={running} className="rounded-md bg-teal-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {running ? "Running…" : "Re-run"}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.results.map((r) => {
          const score = r.passed / r.total;
          const ok = r.gate === undefined || score >= r.gate;
          return (
            <Card key={r.name}>
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{r.name}</h2>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                  {ok ? "PASS" : "FAIL"}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{Math.round(score * 100)}%</span>
                <span className="text-sm text-slate-500">
                  {r.passed}/{r.total} {r.gate !== undefined && `· gate ${Math.round(r.gate * 100)}%`}
                </span>
              </div>
              <div className="mt-2 h-2 rounded bg-slate-100">
                <div className={`h-2 rounded ${ok ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${score * 100}%` }} />
              </div>
              {r.failures.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-xs text-red-700">
                  {r.failures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
      {data && <p className="text-xs text-slate-400">Ran {new Date(data.ranAt).toLocaleTimeString()}</p>}
    </div>
  );
}
