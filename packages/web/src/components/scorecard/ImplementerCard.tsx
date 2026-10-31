import type { ImplementerRow } from "../../api.js";
import { formatCount, formatDuration } from "../../formatters.js";
import { Donut } from "./Donut.js";
import { barWidths, formatDecimal, percent } from "./geometry.js";

export function ImplementerCard({ row, maxTokens }: { row: ImplementerRow; maxTokens: number }) {
  const [inWidth = 0, outWidth = 0] = barWidths([row.inputTokens, row.outputTokens], maxTokens);
  return (
    <article className="sc-panel sc">
      <h3>{row.provider}</h3>
      <div className="muted mono">{row.model}</div>
      <div className="figs">
        <Donut rate={row.firstTryPassRate} />
        <div>
          <div className="big">{percent(row.firstTryPassRate)}</div>
          <div className="muted">first-try pass rate</div>
        </div>
      </div>
      <div className="mini">
        <div><b>{row.tasks}</b>tasks</div>
        <div><b>{row.passed}</b>passed</div>
        <div><b>{formatDecimal(row.meanRetries)}</b>mean retries</div>
        <div><b>{formatDuration(row.meanDurationMs)}</b>mean time</div>
      </div>
      <div className="barlab">
        <span>Input {formatCount(row.inputTokens)}</span>
        <span>Output {formatCount(row.outputTokens)}</span>
      </div>
      <div className="bar" role="img" aria-label={`${formatCount(row.inputTokens)} input, ${formatCount(row.outputTokens)} output tokens`}>
        <span style={{ width: `${inWidth}%`, background: "var(--accent)" }} />
        <span style={{ width: `${outWidth}%`, background: "var(--dot-needs_review)" }} />
      </div>
    </article>
  );
}
