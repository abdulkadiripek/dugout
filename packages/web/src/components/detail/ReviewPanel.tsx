import { groupIssues, REVIEW_CARD_ID, type ReviewInfo } from "./derive.js";

const SEV_CLASS = { blocker: "hi", major: "hi", minor: "mid", nit: "lo" } as const;

export function ReviewPanel({ review }: { review: ReviewInfo }) {
  const approve = review.result.verdict === "approve";
  const groups = groupIssues(review.result.issues);
  return (
    <section className="panel" id={REVIEW_CARD_ID} tabIndex={-1} aria-labelledby="review-h">
      <h2 id="review-h" className="sec">Review</h2>
      <div className="panel-head">
        <span className={`pill ${approve ? "passed" : "needs_review"}`}>
          <i aria-hidden="true"><b>{approve ? "✓" : "!"}</b></i>
          <span>{review.result.verdict.replace("_", " ")}</span>
        </span>
        <span className="muted">reviewed by {review.provider} · {review.model}</span>
      </div>
      <p>{review.result.summary}</p>
      {groups.length === 0 ? <p className="muted">No issues reported.</p> : null}
      {groups.map((g) => (
        <div key={g.severity}>
          <h3 className="sev-h">{g.severity} ({g.issues.length})</h3>
          {g.issues.map((i, idx) => (
            <div className="issue" key={idx}>
              <span className={`sev ${SEV_CLASS[g.severity]}`}>{i.severity}</span>
              <div>
                {i.message}
                <div className="loc mono">{i.file}{i.line ? `:${i.line}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
