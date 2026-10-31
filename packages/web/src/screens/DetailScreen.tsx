import { useCallback, useEffect, useState } from "react";
import { ApiError, getDiff, getTask, type DiffResult, type TaskDetail } from "../api.js";
import { AttemptCard } from "../components/detail/AttemptCard.js";
import { deriveAttempts, deriveReview, deriveSetup } from "../components/detail/derive.js";
import { DetailHeader } from "../components/detail/DetailHeader.js";
import { DiffViewer } from "../components/detail/DiffViewer.js";
import { ReviewPanel } from "../components/detail/ReviewPanel.js";
import { SetupCard } from "../components/detail/SetupCard.js";
import { Timeline } from "../components/detail/Timeline.js";
import "../styles/detail.css";

type TaskLoad =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "missing" }
  | { state: "ready"; task: TaskDetail };

type DiffLoad =
  | { state: "loading" }
  | { state: "unavailable"; message: string }
  | { state: "ready"; diff: DiffResult };

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

export function DetailScreen({ id }: { id: string }) {
  const [task, setTask] = useState<TaskLoad>({ state: "loading" });
  const [diff, setDiff] = useState<DiffLoad>({ state: "loading" });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    setTask({ state: "loading" });
    setDiff({ state: "loading" });
    getTask(id).then(
      (t) => {
        if (!live) return;
        if (!t.summary || !Array.isArray(t.events)) setTask({ state: "error", message: "unexpected response from the server" });
        else setTask({ state: "ready", task: t });
      },
      (err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setTask({ state: "missing" });
        else setTask({ state: "error", message: messageOf(err) });
      },
    );
    getDiff(id).then(
      (d) => { if (live) setDiff({ state: "ready", diff: d }); },
      (err: unknown) => { if (live) setDiff({ state: "unavailable", message: messageOf(err) }); },
    );
    return () => { live = false; };
  }, [id, tries]);

  const retry = useCallback(() => setTries((n) => n + 1), []);
  const back = <a className="back" href="#/">&larr; All tasks <span className="kbd">Esc</span></a>;

  if (task.state === "loading") {
    return <section>{back}<p role="status" className="lede">Loading task…</p></section>;
  }
  if (task.state === "missing") {
    return (
      <section>
        {back}
        <h1>Task not found</h1>
        <p className="lede">No task with id <span className="mono">{id}</span>.</p>
      </section>
    );
  }
  if (task.state === "error") {
    return (
      <section>
        {back}
        <div className="empty" role="alert">
          <p>Could not load task: {task.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </section>
    );
  }

  const { summary, events } = task.task;
  if (summary.status === "unreadable") {
    return <section>{back}<DetailHeader summary={summary} /></section>;
  }
  const attempts = deriveAttempts(events);
  const setup = deriveSetup(events);
  const review = deriveReview(events);
  return (
    <section>
      {back}
      <DetailHeader summary={summary} />
      <h2>Timeline</h2>
      <Timeline events={events} />
      <h2>Attempts</h2>
      {setup || attempts.length > 0 ? (
        <div className="attgrid">
          {setup ? <SetupCard setup={setup} /> : null}
          {attempts.map((a) => <AttemptCard key={a.n} attempt={a} />)}
        </div>
      ) : (
        <p className="muted">No attempts were recorded.</p>
      )}
      {review ? <ReviewPanel review={review} /> : null}
      <h2>Diff</h2>
      {diff.state === "loading" ? <p role="status" className="muted">Loading diff…</p> : null}
      {diff.state === "unavailable" ? <p className="muted" role="note">Diff not available: {diff.message}</p> : null}
      {diff.state === "ready" ? <DiffViewer diff={diff.diff.diff} truncated={diff.diff.truncated} /> : null}
    </section>
  );
}
