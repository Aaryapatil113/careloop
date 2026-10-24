import { runEvals } from "../src/lib/evals";

const { results } = runEvals();
let failed = false;
for (const r of results) {
  const score = r.passed / r.total;
  const ok = r.gate === undefined || score >= r.gate;
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"}  ${r.name.padEnd(40)} ${r.passed}/${r.total} (${(score * 100).toFixed(0)}%)${r.gate ? `  gate ${(r.gate * 100).toFixed(0)}%` : ""}`);
  for (const f of r.failures) console.log(`        - ${f}`);
}
process.exit(failed ? 1 : 0);
