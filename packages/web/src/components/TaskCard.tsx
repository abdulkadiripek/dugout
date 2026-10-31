import type { TaskSummary } from "../api.js";
import { formatDate, formatDuration, formatTokens } from "../formatters.js";
import { AttemptDots } from "./AttemptDots.js";
import { ProviderBadges } from "./ProviderBadges.js";
import { StatusPill } from "./StatusPill.js";

export function TaskCard({ task }: { task: TaskSummary }) {
  const href = `#/tasks/${encodeURIComponent(task.taskId)}`;
  if (task.status === "unreadable") {
    return (
      <a className="card" data-row href={href}>
        <div className="r1"><StatusPill status={task.status} /></div>
        <h3 className="mono">{task.taskId}</h3>
        <p className="reason">{task.reason ?? "This log could not be read."}</p>
      </a>
    );
  }
  const t = formatTokens(task.tokens);
  const max = Math.max(1, task.tokens.input + task.tokens.output);
  return (
    <a className="card" data-row href={href}>
      <div className="r1">
        <StatusPill status={task.status} />
        <span className="muted">{formatDate(task.startedAt)}</span>
      </div>
      <h3>{task.goal}</h3>
      <div className="id mono">{task.taskId}</div>
      {task.reason ? <p className="reason">{task.reason}</p> : null}
      <div className="dots">
        <AttemptDots attempts={task.attempts} status={task.status} />
        <span className="muted">{task.attempts} {task.attempts === 1 ? "attempt" : "attempts"}</span>
      </div>
      <div className="bar" role="img" aria-label={`${t.input} input, ${t.output} output tokens`}>
        <span style={{ width: `${(task.tokens.input / max) * 100}%`, background: "var(--accent)" }} />
        <span style={{ width: `${(task.tokens.output / max) * 100}%`, background: "var(--dot-needs_review)" }} />
      </div>
      <div className="foot">
        <span><ProviderBadges providers={task.providers} /></span>
        <span><b>{formatDuration(task.durationMs)}</b> total</span>
        <span><b>{t.total}</b> tokens</span>
      </div>
    </a>
  );
}
