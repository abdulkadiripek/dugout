import { useMemo } from "react";
import { parseDiff, type DiffLine } from "./diff.js";

const MARK = { add: "+", del: "-", ctx: " ", note: "" } as const;
const KIND_WORD = { add: "added", del: "removed", ctx: "", note: "" } as const;

function Line({ line }: { line: DiffLine }) {
  return (
    <tr className={`dl ${line.kind}`}>
      <td className="no" aria-hidden="true">{line.oldNo ?? ""}</td>
      <td className="no" aria-hidden="true">{line.newNo ?? ""}</td>
      <td className="code">
        <span className="mark" aria-hidden="true">{MARK[line.kind]}</span>
        {KIND_WORD[line.kind] ? <span className="sr-only">{KIND_WORD[line.kind]}: </span> : null}
        {line.text}
      </td>
    </tr>
  );
}

export function DiffViewer({ diff, truncated }: { diff: string; truncated: boolean }) {
  const parsed = useMemo(() => parseDiff(diff), [diff]);
  const showNotice = truncated || parsed.truncation !== null;
  return (
    <div className="diff">
      {showNotice ? (
        <p className="diff-notice" role="note">
          <b>Diff truncated.</b> {parsed.truncation ?? "Only the first part of the diff is shown."}
        </p>
      ) : null}
      {parsed.files.length === 0 ? <p className="muted">No changes in this diff.</p> : null}
      {parsed.files.map((f, i) => (
        <section className="dfile" key={`${f.path}-${i}`} aria-label={`File ${f.path}`}>
          <h3 className="mono">{f.path}</h3>
          {f.binary ? <p className="muted">Binary file changed, no text diff.</p> : null}
          {f.notes.length > 0 ? <p className="muted mono dnotes">{f.notes.join(" · ")}</p> : null}
          {f.hunks.map((h, j) => (
            <div className="dscroll" key={j} tabIndex={0} role="region" aria-label={`${f.path} ${h.header}`}>
              <table className="dtable">
                <tbody>
                  <tr className="dh"><td className="no" aria-hidden="true" /><td className="no" aria-hidden="true" /><td className="code">{h.header}</td></tr>
                  {h.lines.map((l, k) => <Line key={k} line={l} />)}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
