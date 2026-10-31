import { formatDuration } from "../../formatters.js";
import { SETUP_CARD_ID, type SetupInfo } from "./derive.js";

export function SetupCard({ setup }: { setup: SetupInfo }) {
  return (
    <article className="panel" id={SETUP_CARD_ID} tabIndex={-1} aria-labelledby={`${SETUP_CARD_ID}-h`}>
      <div className="panel-head">
        <h3 id={`${SETUP_CARD_ID}-h`}>Setup</h3>
        <span className={`pill ${setup.passed ? "passed" : "failed"}`}>
          <i aria-hidden="true"><b>{setup.passed ? "✓" : "✕"}</b></i>
          <span>Setup {setup.passed ? "passed" : "failed"}</span>
        </span>
      </div>
      <div className="row2">
        <span>Exit <b>{setup.exitCode}</b></span>
        <span>Took <b>{formatDuration(setup.durationMs)}</b></span>
      </div>
      <pre tabIndex={0} aria-label="Setup output">{setup.outputTail || "(no output)"}</pre>
    </article>
  );
}
