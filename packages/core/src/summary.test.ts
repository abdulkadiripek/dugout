import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { summarizeLog } from "./index.js";

const dir = new URL("../../../fixtures/events/", import.meta.url);
const linesOf = (name: string) => readFileSync(new URL(name, dir), "utf8").trimEnd().split("\n");
const load = (name: string) => linesOf(name).map((line) => JSON.parse(line) as Record<string, unknown>);
const dump = (events: unknown[]) => events.map((event) => JSON.stringify(event));

const expectedStatus: Record<string, string> = {
  "success": "passed", "retry": "passed", "fallback": "passed", "review-issues": "needs_review",
  "failed": "failed", "all-failed": "failed", "setup-failed": "failed", "real-codex-claude": "passed", "real-fallback-dogfood": "failed", "real-review-unavailable": "needs_review",
};

it("covers every fixture file and its expected status", () => {
  const files = readdirSync(dir).filter((file) => file.endsWith(".jsonl"));
  expect(files.map((file) => file.slice(0, -6)).sort()).toEqual(Object.keys(expectedStatus).sort());
  for (const [name, status] of Object.entries(expectedStatus)) {
    expect(summarizeLog(linesOf(name + ".jsonl"), name).status, name).toBe(status);
  }
});

it("sums tokens of the real log", () => {
  const summary = summarizeLog(linesOf("real-codex-claude.jsonl"), "x");
  expect(summary.tokens).toEqual({ input: 36519, output: 119 });
  expect(summary.taskId).toBe("live-smoke-e0cf");
  expect(summary.review).not.toBeNull();
});

it("derives providers, attempts, branch and review from the fallback and review logs", () => {
  const fallback = summarizeLog(linesOf("fallback.jsonl"), "x");
  expect(fallback.providers).toEqual(["codex", "claude"]);
  expect(fallback.attempts).toBe(2);
  expect(fallback.branch).toBe("dugout/add-csv-export-e5f6");
  expect(fallback.baseRef).toBe("main");
  expect(fallback.startedAt).toBe("2026-01-16T09:00:00.000Z");
  expect(fallback.durationMs).not.toBeNull();
  const issues = summarizeLog(linesOf("review-issues.jsonl"), "x").review;
  expect(issues?.verdict).toBe("changes_requested");
  expect(issues?.counts).toEqual({ blocker: 0, major: 1, minor: 1, nit: 0 });
});

it("marks a valid log without task.finished as interrupted", () => {
  const events = load("success.jsonl");
  const summary = summarizeLog(dump(events.slice(0, 4)), "x");
  expect(summary.status).toBe("interrupted");
  expect(summary.durationMs).toBeNull();
  expect(summary.attempts).toBe(1);
});

it("summarizes an odd but sequenced lifecycle", () => {
  const events = load("success.jsonl").filter((event) => event.type !== "attempt.finished")
    .map((event, seq) => ({ ...event, seq }));
  expect(summarizeLog(dump(events), "x").status).toBe("passed");
});

it("reports unreadable logs with the first problem and its line", () => {
  const events = load("success.jsonl");
  const bad = summarizeLog([JSON.stringify(events[0]), "{"], "file-name");
  expect(bad).toMatchObject({ taskId: "file-name", status: "unreadable", reason: "bad JSON line 2", attempts: 0, durationMs: null, review: null });
  const version = summarizeLog(dump([{ ...events[0], schemaVersion: 2 }]), "v");
  expect(version.status).toBe("unreadable");
  expect(version.reason).toMatch(/^schema failure on line 1: /);
  expect(version.reason).not.toMatch(/\n/);
  expect(summarizeLog(dump([events[0], { ...events[1], seq: 3 }]), "s").reason).toBe("non-contiguous seq on line 2");
  expect(summarizeLog(dump([events[1]]), "m").status).toBe("unreadable");
});
