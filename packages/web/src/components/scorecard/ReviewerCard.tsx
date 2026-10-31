import type { ReviewerRow } from "../../api.js";
import { barWidths } from "./geometry.js";

const SEVERITIES = [
  ["blocker", "var(--dot-failed)"],
  ["major", "var(--dot-needs_review)"],
  ["minor", "var(--accent)"],
  ["nit", "var(--dot-interrupted)"],
] as const;

export function ReviewerCard({ row }: { row: ReviewerRow }) {
  const total = row.blocker + row.major + row.minor + row.nit;
  const widths = barWidths(SEVERITIES.map(([key]) => row[key]), total);
  return (
    <article className="sc-panel sc sev-stack">
      <h3>{row.provider}</h3>
      <div className="muted mono">{row.model}</div>
      <div className="figs">
        <div>
          <div className="big">{row.reviews}</div>
          <div className="muted">{row.reviews === 1 ? "review" : "reviews"}</div>
        </div>
        <div>
          <div className="big">{total}</div>
          <div className="muted">issues found</div>
        </div>
      </div>
      <div className="bar" role="img" aria-label={`${total} issues by severity: ${SEVERITIES.map(([key]) => `${row[key]} ${key}`).join(", ")}`}>
        {SEVERITIES.map(([key, color], i) => (
          <span key={key} style={{ width: `${widths[i] ?? 0}%`, background: color }} />
        ))}
      </div>
      <div className="legend">
        {SEVERITIES.map(([key, color]) => (
          <span key={key} style={{ "--c": color } as React.CSSProperties}>{key} <b>{row[key]}</b></span>
        ))}
      </div>
    </article>
  );
}
