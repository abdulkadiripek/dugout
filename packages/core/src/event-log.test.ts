import { expect, it } from "vitest";
import { checkEventLog, eventSchema, type Event } from "./index.js";

const envelope = { schemaVersion: 1, ts: "2026-01-15T10:00:00.000Z", taskId: "task-ab12" };
const created = eventSchema.parse({
  ...envelope, seq: 0, type: "task.created",
  package: {
    id: "task", goal: "Do a task.", files_to_read: [], constraints: [],
    acceptance: ["Works"], verify: "pnpm test",
  },
});
const started = eventSchema.parse({
  ...envelope, seq: 1, type: "attempt.started", attempt: 1,
  reason: "initial", provider: "fake", model: "fake",
});
const finished = eventSchema.parse({
  ...envelope, seq: 2, type: "attempt.finished", attempt: 1,
  status: "completed", exitReason: "ok", durationMs: 10,
});
const done = eventSchema.parse({
  ...envelope, seq: 3, type: "task.finished", status: "passed", attempts: 1,
  providers: ["fake"], diffStat: { files: 0, additions: 0, deletions: 0 }, durationMs: 10,
});
const log = [created, started, finished, done];
const resequence = (events: Event[]) => events.map((event, seq) => ({ ...event, seq }));

it("accepts a complete log without mutating it", () => {
  const before = structuredClone(log);
  expect(checkEventLog(log)).toEqual([]);
  expect(log).toEqual(before);
});

it.each([5, 1, -1])("detects non-contiguous seq %i", (seq) => {
  expect(checkEventLog([created, { ...started, seq }, finished, done]).some((p) => p.includes("seq")))
    .toBe(seq !== 1);
});

it("requires seq to start at zero", () => {
  expect(checkEventLog(log.map((event) => ({ ...event, seq: event.seq + 1 })))).toContain(
    "Non-contiguous seq: expected 0, received 1",
  );
});

it("requires task.created first", () => {
  expect(checkEventLog(resequence([started, finished, done]))).toContain("First event must be task.created");
});

it("detects missing and duplicated task.finished", () => {
  expect(checkEventLog(log.slice(0, -1))).toContain("Expected exactly one task.finished, found 0");
  expect(checkEventLog(resequence([...log, done]))).toContain("Expected exactly one task.finished, found 2");
});

it("requires task.finished last", () => {
  expect(checkEventLog(resequence([created, done, started, finished]))).toContain("Last event must be task.finished");
});

it("detects an unmatched attempt.started", () => {
  expect(checkEventLog(resequence([created, started, done]))).toContain(
    "attempt.started without matching attempt.finished for attempt 1",
  );
});

it("matches attempts by number", () => {
  expect(checkEventLog([created, started, eventSchema.parse({ ...finished, attempt: 2 }), done])).toEqual([
    "attempt.finished without matching attempt.started for attempt 2",
    "attempt.started without matching attempt.finished for attempt 1",
  ]);
});

it("detects orphaned, reversed and duplicated attempt events", () => {
  expect(checkEventLog(resequence([created, finished, started, done]))).toHaveLength(2);
  expect(checkEventLog(resequence([created, started, started, finished, done]))).toContain(
    "Duplicate attempt.started for attempt 1",
  );
  expect(checkEventLog(resequence([created, started, finished, finished, done]))).toContain(
    "attempt.finished without matching attempt.started for attempt 1",
  );
});

it("reports an empty log", () => {
  expect(checkEventLog([])).toEqual([
    "First event must be task.created", "Expected exactly one task.finished, found 0",
  ]);
});

const worktree = eventSchema.parse({
  ...envelope, seq: 1, type: "worktree.created", path: ".worktrees/task-ab12", branch: "panosu/task-ab12", baseRef: "main",
});
const setupFinished = eventSchema.parse({
  ...envelope, seq: 2, type: "setup.finished", passed: false, exitCode: 1, durationMs: 10, outputTail: "Failed",
});

it("reports setup before worktree creation", () => {
  expect(checkEventLog(resequence([created, setupFinished, worktree, done])))
    .toContain("setup.finished before worktree.created");
});

it("reports attempts following failed setup", () => {
  expect(checkEventLog(resequence([created, worktree, setupFinished, started, finished, done])))
    .toEqual(["attempt.started after failed setup.finished"]);
});

it("accepts attempts following passed setup", () => {
  expect(checkEventLog(resequence([
    created, worktree, eventSchema.parse({ ...setupFinished, passed: true, exitCode: 0 }), started, finished, done,
  ]))).toEqual([]);
});
