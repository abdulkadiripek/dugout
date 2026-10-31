import { formatCount, formatDuration } from "../../formatters.js";
import { Collapsible } from "./Collapsible.js";
import { attemptCardId, exitReasonText, type AttemptInfo } from "./derive.js";

export function AttemptCard({ attempt: a }: { attempt: AttemptInfo }) {
  const ok = a.status === "completed";
  const v = a.verify;
  const subCount = a.tools.length + a.messages.length;
  return (
    <article className="panel" id={attemptCardId(a.n)} tabIndex={-1} aria-labelledby={`${attemptCardId(a.n)}-h`}>
      <div className="panel-head">
        <h3 id={`${attemptCardId(a.n)}-h`}>Attempt {a.n} · {a.provider}</h3>
        {a.status === null ? (
          <span className="pill interrupted"><i aria-hidden="true"><b>…</b></i><span>No result</span></span>
        ) : (
          <span className={`pill ${ok ? "passed" : "failed"}`}>
            <i aria-hidden="true"><b>{ok ? "✓" : "✕"}</b></i>
            <span>{ok ? "Completed" : "Failed"}</span>
          </span>
        )}
      </div>
      <div className="muted mono">{a.model}</div>
      <div className="row2">
        <span>Reason <b>{a.reason}</b></span>
        <span>Exit <b>{a.exitReason ?? "none"}</b> <span className="muted">({exitReasonText(a.exitReason)})</span></span>
        <span>Took <b>{formatDuration(a.durationMs)}</b></span>
        <span><b>{formatCount(a.input)}</b> in</span>
        <span><b>{formatCount(a.output)}</b> out</span>
      </div>
      {v ? (
        <>
          <div className="row2">
            {v.passed === null ? (
              <span className="pill interrupted"><i aria-hidden="true"><b>…</b></i><span>Verify no result</span></span>
            ) : (
              <span className={`pill ${v.passed ? "passed" : "failed"}`}>
                <i aria-hidden="true"><b>{v.passed ? "✓" : "✕"}</b></i>
                <span>Verify {v.passed ? "passed" : "failed"}</span>
              </span>
            )}
            <span className="mono">{v.command}</span>
            {v.exitCode !== null ? <span>exit <b>{v.exitCode}</b> · {formatDuration(v.durationMs)}</span> : null}
          </div>
          <pre tabIndex={0} aria-label={`Verify output, attempt ${a.n}`}>{v.outputTail || "(no output)"}</pre>
        </>
      ) : (
        <p className="muted">Verify did not run.</p>
      )}
      {subCount > 0 ? (
        <Collapsible label={`${subCount} tool calls and messages`}>
          <ul>
            {a.tools.map((t, i) => <li key={`t${i}`}><b>{t.name}</b> {t.summary}</li>)}
            {a.messages.map((m, i) => <li key={`m${i}`}><i>{m}</i></li>)}
          </ul>
        </Collapsible>
      ) : null}
    </article>
  );
}
