/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { eventSchema, checkEventLog } from "./index.js";

const fixtureDirectory = new URL("../../../fixtures/events/", import.meta.url);
const fixtures = readdirSync(fixtureDirectory).filter((name) => name.endsWith(".jsonl"));

it("finds fixture logs", () => {
  expect(fixtures.length).toBeGreaterThan(0);
});

it.each(fixtures)("validates every event and lifecycle in %s", (name) => {
  const events = readFileSync(new URL(name, fixtureDirectory), "utf8").trim().split(/\r?\n/)
    .map((line) => eventSchema.parse(JSON.parse(line)));
  expect(checkEventLog(events)).toEqual([]);
});

const envelope = { schemaVersion: 1, seq: 0, ts: "2026-01-15T10:00:00.000Z", taskId: "task-ab12" };
const message = { ...envelope, type: "provider.message", attempt: 1, text: "Hello" };

it.each([
  { schemaVersion: 2 }, { type: "unknown" }, { seq: -1 }, { seq: 0.5 },
  { ts: "yesterday" }, { ts: "2026-01-15T10:00:00+01:00" },
  { taskId: undefined }, { attempt: 0 }, { text: "x".repeat(501) },
])("rejects invalid event fields %j", (invalid) => {
  expect(eventSchema.safeParse({ ...message, ...invalid }).success).toBe(false);
});

it("accepts provider messages at the length limit", () => {
  expect(eventSchema.parse({ ...message, text: "x".repeat(500) }).type).toBe("provider.message");
});

it("allows omitted usage counts", () => {
  expect(eventSchema.parse({ ...envelope, type: "provider.usage", attempt: 1 })).toEqual({
    ...envelope, type: "provider.usage", attempt: 1,
  });
});

it.each(["ok", "rate_limit", "auth", "timeout", "crash", "invalid_output"])(
  "accepts exit reason %s", (exitReason) => {
    expect(eventSchema.safeParse({
      ...envelope, type: "attempt.finished", attempt: 1,
      status: "failed", exitReason, durationMs: 0,
    }).success).toBe(true);
  },
);

it("rejects invalid nested package and review fields", () => {
  expect(() => eventSchema.parse({ ...envelope, type: "task.created", package: {} })).toThrow(/acceptance/);
  expect(() => eventSchema.parse({
    ...envelope, type: "review.finished", provider: "fake", model: "fake",
    result: { verdict: "changes_requested", summary: "Fine.", issues: [] },
  })).toThrow(/verdict/);
});
