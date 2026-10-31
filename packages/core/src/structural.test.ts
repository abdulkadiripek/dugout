import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { eventSchema, type Event } from "./events.js";
import { structurallyEqual } from "./structural.js";

const events = ["success", "fallback"].flatMap((name) =>
  readFileSync(new URL(`../../../fixtures/events/${name}.jsonl`, import.meta.url), "utf8")
    .trim().split("\n").map((line) => eventSchema.parse(JSON.parse(line))));

it.each([
  ["type", "task.created", "worktree.created"],
  ["attempt", "attempt.started", 9],
  ["reason", "attempt.started", "retry"],
  ["provider", "attempt.started", "fake"],
  ["status", "attempt.finished", "failed"],
  ["exitReason", "attempt.finished", "crash"],
  ["from", "fallback.triggered", "fake"],
  ["to", "fallback.triggered", "fake"],
  ["passed", "verify.finished", false],
  ["exitCode", "verify.finished", 1],
  ["verdict", "review.finished", "changes_requested"],
  ["attempts", "task.finished", 9],
  ["providers", "task.finished", ["claude", "codex"]],
] as const)("detects changed %s", (field, type, value) => {
  const changed = events.map((event) => {
    if (event.type !== type) return event;
    if (field === "verdict" && event.type === "review.finished") {
      return { ...event, result: { ...event.result, verdict: "changes_requested" as const } };
    }
    return { ...event, [field]: value } as Event;
  });
  expect(structurallyEqual(events, changed)).toBe(false);
});

it("ignores provider events, envelopes, durations, paths, models, output and review prose", () => {
  const changed: Event[] = events.filter((event) => !event.type.startsWith("provider.")).map((event) => ({
    ...event, seq: 99, ts: "2026-10-31T00:00:00Z", taskId: "other", durationMs: 999,
    model: "other", path: "other", branch: "other", baseRef: "other", outputTail: "other",
    command: "other", diffStat: { files: 99, additions: 99, deletions: 99 },
    ...(event.type === "review.finished" ? { result: { ...event.result, summary: "other", issues: [] } } : {}),
  }));
  changed.push({ schemaVersion: 1, seq: 0, ts: "", taskId: "", type: "provider.message", attempt: 99, text: "other" });
  expect(structurallyEqual(events, changed)).toBe(true);
  expect(structurallyEqual([], [])).toBe(true);
});

it("detects missing events and provider order changes", () => {
  expect(structurallyEqual(events, events.slice(1))).toBe(false);
  const changed = events.map((event) => event.type === "task.finished"
    ? { ...event, providers: [...event.providers].reverse() } : event);
  expect(structurallyEqual(events, changed)).toBe(false);
});
