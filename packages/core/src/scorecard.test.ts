import { expect, it } from "vitest";
import { computeScorecard, eventSchema, type Event } from "./index.js";

const base = { schemaVersion: 1, ts: "2026-01-15T10:00:00.000Z", taskId: "t" };
type Step =
  | { s: "start"; n: number; p: "codex" | "claude"; m: string; r?: "initial" | "retry" | "fallback" }
  | { s: "end"; n: number; ms: number }
  | { s: "usage"; n: number; i: number; o: number }
  | { s: "review"; p: "codex" | "claude"; m: string; sev: ("blocker" | "major" | "minor" | "nit")[] }
  | { s: "done"; status: "passed" | "needs_review" | "failed" };

function log(...steps: Step[]): Event[] {
  const raw: Record<string, unknown>[] = [{
    type: "task.created",
    package: { id: "t", goal: "g", files_to_read: [], constraints: [], acceptance: ["a"], verify: "v" },
  }];
  for (const st of steps) {
    if (st.s === "start") raw.push({ type: "attempt.started", attempt: st.n, reason: st.r ?? "initial", provider: st.p, model: st.m });
    if (st.s === "end") raw.push({ type: "attempt.finished", attempt: st.n, status: "completed", exitReason: "ok", durationMs: st.ms });
    if (st.s === "usage") raw.push({ type: "provider.usage", attempt: st.n, inputTokens: st.i, outputTokens: st.o });
    if (st.s === "review") {
      raw.push({ type: "review.started", provider: st.p, model: st.m });
      raw.push({
        type: "review.finished", provider: st.p, model: st.m,
        result: {
          verdict: st.sev.some((v) => v === "blocker" || v === "major") ? "changes_requested" : "approve",
          summary: "s", issues: st.sev.map((severity) => ({ file: "a.ts", severity, message: "m" })),
        },
      });
    }
    if (st.s === "done") {
      raw.push({
        type: "task.finished", status: st.status, attempts: 0, providers: [],
        diffStat: { files: 0, additions: 0, deletions: 0 }, durationMs: 0,
      });
    }
  }
  return raw.map((event, seq) => eventSchema.parse({ ...base, ...event, seq }));
}
const none = { interrupted: 0, unreadable: 0 };

it("returns empty rows for empty input", () => {
  expect(computeScorecard({ logs: [], excluded: none })).toEqual({ implementers: [], reviewers: [], excluded: none });
});

it("computes a first-try pass", () => {
  const card = computeScorecard({
    logs: [log(
      { s: "start", n: 1, p: "codex", m: "a" }, { s: "usage", n: 1, i: 100, o: 10 },
      { s: "end", n: 1, ms: 1000 }, { s: "done", status: "passed" },
    )],
    excluded: none,
  });
  expect(card.implementers).toEqual([{
    provider: "codex", model: "a", tasks: 1, passed: 1, firstTryPassRate: 1,
    meanRetries: 0, meanDurationMs: 1000, inputTokens: 100, outputTokens: 10,
  }]);
});

it("counts a pass after a retry as passed but not first try", () => {
  const [row] = computeScorecard({
    logs: [log(
      { s: "start", n: 1, p: "codex", m: "a" }, { s: "end", n: 1, ms: 1000 },
      { s: "start", n: 2, p: "codex", m: "a", r: "retry" }, { s: "end", n: 2, ms: 500 },
      { s: "done", status: "passed" },
    )],
    excluded: none,
  }).implementers;
  expect(row).toMatchObject({ tasks: 1, passed: 1, firstTryPassRate: 0, meanRetries: 1, meanDurationMs: 1500 });
});

it("credits a fallback task to the last provider only", () => {
  const card = computeScorecard({
    logs: [log(
      { s: "start", n: 1, p: "codex", m: "a" }, { s: "usage", n: 1, i: 5, o: 1 }, { s: "end", n: 1, ms: 100 },
      { s: "start", n: 2, p: "claude", m: "b", r: "fallback" }, { s: "usage", n: 2, i: 7, o: 2 }, { s: "end", n: 2, ms: 300 },
      { s: "done", status: "passed" },
    )],
    excluded: none,
  });
  expect(card.implementers).toEqual([
    { provider: "claude", model: "b", tasks: 1, passed: 1, firstTryPassRate: 0, meanRetries: 0, meanDurationMs: 300, inputTokens: 7, outputTokens: 2 },
    { provider: "codex", model: "a", tasks: 1, passed: 0, firstTryPassRate: 0, meanRetries: 0, meanDurationMs: 100, inputTokens: 5, outputTokens: 1 },
  ]);
});

it("does not count a failed task as passed", () => {
  const [row] = computeScorecard({
    logs: [log({ s: "start", n: 1, p: "codex", m: "a" }, { s: "end", n: 1, ms: 10 }, { s: "done", status: "failed" })],
    excluded: none,
  }).implementers;
  expect(row).toMatchObject({ tasks: 1, passed: 0, firstTryPassRate: 0 });
});

it("keeps two models of one provider apart and rounds to 4 decimals, sorted by tasks", () => {
  const pass = (m: string) => log({ s: "start", n: 1, p: "codex", m }, { s: "end", n: 1, ms: 100 }, { s: "done", status: "passed" });
  const fail = (m: string) => log({ s: "start", n: 1, p: "codex", m }, { s: "end", n: 1, ms: 100 }, { s: "done", status: "failed" });
  const card = computeScorecard({ logs: [pass("a"), pass("a"), fail("a"), pass("b")], excluded: none });
  expect(card.implementers.map((row) => [row.model, row.tasks, row.passed, row.firstTryPassRate])).toEqual([
    ["a", 3, 2, 0.6667],
    ["b", 1, 1, 1],
  ]);
});

it("rounds mean duration to 4 decimals", () => {
  const withMs = (ms: number) => log({ s: "start", n: 1, p: "codex", m: "a" }, { s: "end", n: 1, ms }, { s: "done", status: "passed" });
  const [row] = computeScorecard({ logs: [withMs(1), withMs(1), withMs(2)], excluded: none }).implementers;
  expect(row?.meanDurationMs).toBe(1.3333);
});

it("sorts ties by provider then model", () => {
  const one = (p: "codex" | "claude", m: string) => log({ s: "start", n: 1, p, m }, { s: "end", n: 1, ms: 1 }, { s: "done", status: "passed" });
  const card = computeScorecard({ logs: [one("codex", "a"), one("claude", "z"), one("claude", "b")], excluded: none });
  expect(card.implementers.map((row) => `${row.provider}/${row.model}`)).toEqual(["claude/b", "claude/z", "codex/a"]);
});

it("builds reviewer rows with issue counts", () => {
  const card = computeScorecard({
    logs: [
      log({ s: "review", p: "claude", m: "r", sev: ["blocker", "nit", "nit"] }, { s: "done", status: "needs_review" }),
      log({ s: "review", p: "claude", m: "r", sev: ["minor"] }, { s: "done", status: "passed" }),
      log({ s: "review", p: "codex", m: "q", sev: [] }, { s: "done", status: "passed" }),
    ],
    excluded: none,
  });
  expect(card.reviewers).toEqual([
    { provider: "claude", model: "r", reviews: 2, blocker: 1, major: 0, minor: 1, nit: 2 },
    { provider: "codex", model: "q", reviews: 1, blocker: 0, major: 0, minor: 0, nit: 0 },
  ]);
});

it("passes the excluded counts through", () => {
  expect(computeScorecard({ logs: [], excluded: { interrupted: 2, unreadable: 3 } }).excluded).toEqual({ interrupted: 2, unreadable: 3 });
});
