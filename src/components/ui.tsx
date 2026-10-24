import type { TriageLevel } from "@/lib/types";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

const LEVEL_STYLE: Record<TriageLevel, string> = {
  none: "bg-slate-100 text-slate-600",
  scope: "bg-sky-100 text-sky-800",
  urgent: "bg-amber-100 text-amber-800",
  emergency: "bg-red-100 text-red-800",
};
const LEVEL_LABEL: Record<TriageLevel, string> = {
  none: "No flags",
  scope: "Prescriber question",
  urgent: "Urgent",
  emergency: "Emergency",
};

export function LevelBadge({ level }: { level: TriageLevel }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}</span>;
}

/** Renders coach text, turning [doc-id] markers into citation chips and **bold** into <strong>. */
export function CoachText({ text }: { text: string }) {
  const parts = text.split(/(\[[a-z0-9-]+\]|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[[a-z0-9-]+\]$/.test(p) ? (
          <sup key={i} className="mx-0.5 rounded bg-teal-50 px-1 py-px font-mono text-[10px] text-teal-700">
            {p.slice(1, -1)}
          </sup>
        ) : /^\*\*.*\*\*$/.test(p) ? (
          <strong key={i}>{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export const ago = (iso: string) => {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
