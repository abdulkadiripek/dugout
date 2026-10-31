import { useCallback, useEffect, useState } from "react";
import { getScorecard, type Scorecard } from "../api.js";
import { ImplementerCard } from "../components/scorecard/ImplementerCard.js";
import { ReviewerCard } from "../components/scorecard/ReviewerCard.js";
import "../styles/scorecard.css";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; scorecard: Scorecard };

function Back() {
  return <a className="back" href="#/">&larr; All tasks</a>;
}

export function ScorecardScreen() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    getScorecard().then(
      (scorecard) => { if (live) setLoad({ state: "ready", scorecard }); },
      (err: unknown) => { if (live) setLoad({ state: "error", message: err instanceof Error ? err.message : String(err) }); },
    );
    return () => { live = false; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (load.state === "loading") {
    return (
      <section>
        <Back />
        <h1>Scorecard</h1>
        <p role="status" className="lede">Loading scorecard…</p>
      </section>
    );
  }
  if (load.state === "error") {
    return (
      <section>
        <Back />
        <h1>Scorecard</h1>
        <div className="empty" role="alert">
          <p>Could not load the scorecard: {load.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </section>
    );
  }
  const { implementers, reviewers, excluded } = load.scorecard;
  if (implementers.length === 0 && reviewers.length === 0) {
    return (
      <section>
        <Back />
        <h1>Scorecard</h1>
        <div className="empty">
          <p><b>No finished tasks yet.</b></p>
          <p>To look around without running anything, start the server with fixture data using <span className="mono">pnpm demo</span>.</p>
        </div>
      </section>
    );
  }
  const maxTokens = Math.max(0, ...implementers.map((r) => r.inputTokens + r.outputTokens));
  return (
    <section className="scorecard">
      <Back />
      <h1>Scorecard</h1>
      <p className="lede">
        Finished tasks only. Left out: {excluded.interrupted} interrupted and {excluded.unreadable} unreadable logs.
      </p>
      <h2>Implementers</h2>
      {implementers.length === 0 ? (
        <p className="muted">No implementer attempts yet.</p>
      ) : (
        <ul className="sgrid" aria-label="Implementers">
          {implementers.map((r) => <li key={`${r.provider}/${r.model}`}><ImplementerCard row={r} maxTokens={maxTokens} /></li>)}
        </ul>
      )}
      <h2>Reviewers</h2>
      {reviewers.length === 0 ? (
        <p className="muted">No reviews yet.</p>
      ) : (
        <ul className="sgrid" aria-label="Reviewers">
          {reviewers.map((r) => <li key={`${r.provider}/${r.model}`}><ReviewerCard row={r} /></li>)}
        </ul>
      )}
      <p className="note">First try means passed with exactly one attempt.</p>
    </section>
  );
}
