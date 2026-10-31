import { useCallback, useEffect, useMemo, useState } from "react";
import { getTasks, type TaskStatus, type TaskSummary } from "../api.js";
import { STATUS_META, STATUS_ORDER } from "../components/StatusPill.js";
import { TaskCard } from "../components/TaskCard.js";

type Load =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ready"; tasks: TaskSummary[] };

type Filter<T extends string> = T | "all";

function Seg({ label, items, current, onPick }: {
  label: string;
  items: [string, string][];
  current: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <div className="lab" aria-hidden="true">{label}</div>
      {items.map(([value, text]) => (
        <button key={value} type="button" aria-pressed={current === value} onClick={() => onPick(value)}>{text}</button>
      ))}
    </div>
  );
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("[data-row]")];
}

function useListKeys() {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const target = ev.target instanceof HTMLElement ? ev.target : null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const onBodyOrMain = !target || target === document.body || target.id === "app";
      const list = rows();
      if (list.length === 0) return;
      const i = document.activeElement instanceof HTMLElement ? list.indexOf(document.activeElement) : -1;
      if (ev.key === "j" || ev.key === "ArrowDown") {
        list[Math.min(i + 1, list.length - 1)]?.focus();
        ev.preventDefault();
      } else if (ev.key === "k" || ev.key === "ArrowUp") {
        list[Math.max(i - 1, 0)]?.focus();
        ev.preventDefault();
      } else if (ev.key === "Enter" && i < 0 && onBodyOrMain) {
        list[0]?.click();
        ev.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export function ListScreen() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<Filter<TaskStatus>>("all");
  const [provider, setProvider] = useState<string>("all");

  useListKeys();

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    getTasks({ limit: 500 }).then(
      (tasks) => { if (live) setLoad({ state: "ready", tasks }); },
      (err: unknown) => { if (live) setLoad({ state: "error", message: err instanceof Error ? err.message : String(err) }); },
    );
    return () => { live = false; };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const all = load.state === "ready" ? load.tasks : [];
  const providers = useMemo(() => [...new Set(all.flatMap((t) => t.providers))].sort(), [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const s of STATUS_ORDER) c[s] = all.filter((t) => t.status === s).length;
    return c;
  }, [all]);
  const items = all.filter((t) =>
    (status === "all" || t.status === status) && (provider === "all" || t.providers.some((p) => p === provider)));

  if (load.state === "loading") {
    return (
      <section>
        <h1>Recent work</h1>
        <p role="status" className="lede">Loading tasks…</p>
      </section>
    );
  }
  if (load.state === "error") {
    return (
      <section>
        <h1>Recent work</h1>
        <div className="empty" role="alert">
          <p>Could not load tasks: {load.message}</p>
          <button type="button" onClick={retry}>Retry</button>
        </div>
      </section>
    );
  }
  if (all.length === 0) {
    return (
      <section>
        <h1>Recent work</h1>
        <div className="empty">
          <p><b>No tasks yet.</b></p>
          <p>
            The board reads event logs written by <span className="mono">dugout delegate</span> to{" "}
            <span className="mono">~/.dugout/events/</span>.
          </p>
          <p>To look around without running anything, start the server with fixture data using <span className="mono">pnpm demo</span>.</p>
        </div>
      </section>
    );
  }
  return (
    <section>
      <h1>Recent work</h1>
      <p className="lede">
        {items.length} of {counts["all"]} tasks. Use <span className="kbd">j</span> <span className="kbd">k</span> to move,{" "}
        <span className="kbd">Enter</span> to open.
      </p>
      <Seg
        label="Status"
        current={status}
        onPick={(v) => setStatus(v as Filter<TaskStatus>)}
        items={[
          ["all", `All ${counts["all"]}`],
          ...STATUS_ORDER.filter((s) => (counts[s] ?? 0) > 0).map((s): [string, string] => [s, `${STATUS_META[s].label} ${counts[s]}`]),
        ]}
      />
      <Seg label="Provider" current={provider} onPick={setProvider} items={[["all", "Any"], ...providers.map((p): [string, string] => [p, p])]} />
      {items.length === 0 ? (
        <div className="empty">No tasks match these filters.</div>
      ) : (
        <ul className="cards">
          {items.map((t) => <li key={t.taskId}><TaskCard task={t} /></li>)}
        </ul>
      )}
      <p className="note">Dots show each attempt (check = completed, cross = failed). The bar splits input and output tokens.</p>
    </section>
  );
}
