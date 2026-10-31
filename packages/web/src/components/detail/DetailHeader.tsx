import type { TaskSummary } from "../../api.js";
import { formatDateTime, formatDuration, formatTokens } from "../../formatters.js";
import { ProviderBadges } from "../ProviderBadges.js";
import { StatusPill } from "../StatusPill.js";
import { TOP_ID } from "./derive.js";

export function DetailHeader({ summary }: { summary: TaskSummary }) {
  if (summary.status === "unreadable") {
    return (
      <div className="hero" id={TOP_ID} tabIndex={-1}>
        <StatusPill status={summary.status} />
        <h1 className="mono">{summary.taskId}</h1>
        <p className="muted">This log could not be read: {summary.reason ?? "unknown reason"}</p>
      </div>
    );
  }
  const t = formatTokens(summary.tokens);
  return (
    <div className="hero" id={TOP_ID} tabIndex={-1}>
      <StatusPill status={summary.status} />
      <h1>{summary.goal}</h1>
      <div className="muted mono">{summary.taskId}</div>
      {summary.reason ? <p className="muted">{summary.reason}</p> : null}
      <dl className="stats">
        <div><dt>Package</dt><dd className="small mono">{summary.packageId}</dd></div>
        <div><dt>Started</dt><dd className="small">{formatDateTime(summary.startedAt)}</dd></div>
        <div><dt>Duration</dt><dd>{formatDuration(summary.durationMs)}</dd></div>
        <div><dt>Attempts</dt><dd>{summary.attempts}</dd></div>
        <div><dt>Providers</dt><dd className="small"><ProviderBadges providers={summary.providers} /></dd></div>
        <div><dt>Tokens in / out</dt><dd>{t.input} / {t.output}</dd></div>
        <div><dt>Base</dt><dd className="small mono">{summary.baseRef || "—"}</dd></div>
        <div><dt>Branch</dt><dd className="small mono">{summary.branch || "—"}</dd></div>
      </dl>
    </div>
  );
}
