import { eventSchema, type Event } from "./events.js";
import type { TaskSummary } from "./api-schemas.js";

export type ParsedLog = { ok: true; events: Event[] } | { ok: false; reason: string };

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export function parseLog(lines: readonly string[]): ParsedLog {
  const events: Event[] = [];
  for (const [index, line] of lines.entries()) {
    const lineNo = index + 1;
    let value: unknown;
    try { value = JSON.parse(line); } catch { return { ok: false, reason: `bad JSON line ${lineNo}` }; }
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success) {
      return { ok: false, reason: oneLine(`schema failure on line ${lineNo}: ${parsed.error.message}`) };
    }
    if (parsed.data.seq !== index) return { ok: false, reason: `non-contiguous seq on line ${lineNo}` };
    events.push(parsed.data);
  }
  if (events[0]?.type !== "task.created") return { ok: false, reason: "missing task.created" };
  return { ok: true, events };
}

function unreadable(fileName: string, reason: string): TaskSummary {
  return {
    taskId: fileName, packageId: "", goal: "", status: "unreadable", reason,
    providers: [], attempts: 0, startedAt: "", durationMs: null,
    tokens: { input: 0, output: 0 }, review: null, branch: "", baseRef: "",
  };
}

export function summarizeEvents(events: readonly Event[]): TaskSummary {
  const created = events.find((event) => event.type === "task.created");
  const finished = events.findLast((event) => event.type === "task.finished");
  const worktree = events.find((event) => event.type === "worktree.created");
  const review = events.findLast((event) => event.type === "review.finished");
  const attempts = events.filter((event) => event.type === "attempt.started");
  const tokens = { input: 0, output: 0 };
  for (const event of events) {
    if (event.type !== "provider.usage") continue;
    tokens.input += event.inputTokens ?? 0;
    tokens.output += event.outputTokens ?? 0;
  }
  const counts = { blocker: 0, major: 0, minor: 0, nit: 0 };
  for (const issue of review?.result.issues ?? []) counts[issue.severity] += 1;
  return {
    taskId: events[0]?.taskId ?? "",
    packageId: created?.package.id ?? "",
    goal: created?.package.goal ?? "",
    status: finished?.status ?? "interrupted",
    providers: [...new Set(attempts.map((event) => event.provider))],
    attempts: attempts.length,
    startedAt: created?.ts ?? "",
    durationMs: finished?.durationMs ?? null,
    tokens,
    review: review ? { verdict: review.result.verdict, counts } : null,
    branch: worktree?.branch ?? "",
    baseRef: worktree?.baseRef ?? "",
  };
}

export function summarizeLog(lines: readonly string[], fileName: string): TaskSummary {
  const parsed = parseLog(lines);
  return parsed.ok ? summarizeEvents(parsed.events) : unreadable(fileName, parsed.reason);
}
