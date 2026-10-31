import type { TaskStatus } from "../api.js";

type Outcome = "passed" | "failed" | "interrupted";

export function attemptOutcomes(attempts: number, status: TaskStatus): Outcome[] {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < attempts; i++) {
    if (i < attempts - 1) outcomes.push("failed");
    else if (status === "failed") outcomes.push("failed");
    else if (status === "interrupted" || status === "unreadable") outcomes.push("interrupted");
    else outcomes.push("passed");
  }
  return outcomes;
}

const MARKS: Record<Outcome, string> = {
  passed: "M-4 0l3 3 5-6",
  failed: "M-4 -4l8 8M4 -4l-8 8",
  interrupted: "M-5 0h2M-1 0h2M3 0h2",
};
const WORDS: Record<Outcome, string> = { passed: "ok", failed: "failed", interrupted: "not finished" };

export function AttemptDots({ attempts, status }: { attempts: number; status: TaskStatus }) {
  if (attempts <= 0) return <span className="muted">no attempts</span>;
  const outcomes = attemptOutcomes(attempts, status);
  const width = outcomes.length * 26;
  const label = outcomes.map((o, i) => `attempt ${i + 1} ${WORDS[o]}`).join(", ");
  return (
    <svg width={width} height={26} viewBox={`0 0 ${width} 26`} role="img" aria-label={label}>
      <title>{label}</title>
      {outcomes.map((o, i) => (
        <g key={i} transform={`translate(${13 + i * 26} 13)`}>
          <circle r={11} fill={`var(--dot-${o === "passed" ? "passed" : o === "failed" ? "failed" : "interrupted"})`} />
          <path d={MARKS[o]} fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}
