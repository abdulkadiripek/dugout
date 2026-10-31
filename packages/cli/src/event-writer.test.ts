import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { eventSchema, type Event } from "@dugout/core";
import { createEventWriter } from "./event-writer.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "dugout-events-")); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const event: Event = {
  schemaVersion: 1, seq: 0, ts: "2026-10-31T00:00:00Z", taskId: "test-1234",
  type: "verify.started", attempt: 1, command: "true",
};

it("creates nested directories and writes complete schema-valid lines", () => {
  const writer = createEventWriter(join(dir, "nested", "events"), event.taskId);
  expect(existsSync(writer.path)).toBe(true);
  writer.emit(event);
  writer.emit({ ...event, seq: 1 });
  const text = readFileSync(writer.path, "utf8");
  expect(text).toBe(`${JSON.stringify(event)}\n${JSON.stringify({ ...event, seq: 1 })}\n`);
  expect(text.trim().split("\n").map(line => eventSchema.parse(JSON.parse(line)))).toEqual([event, { ...event, seq: 1 }]);
});

it("refuses an existing log without changing it", () => {
  const writer = createEventWriter(dir, event.taskId);
  writer.emit(event);
  expect(() => createEventWriter(dir, event.taskId)).toThrow();
  expect(readFileSync(writer.path, "utf8")).toBe(`${JSON.stringify(event)}\n`);
});

it("writes nothing for invalid events", () => {
  const writer = createEventWriter(dir, event.taskId);
  expect(() => writer.emit({ ...event, seq: -1 })).toThrow();
  expect(readFileSync(writer.path, "utf8")).toBe("");
  writer.emit(event);
  expect(() => writer.emit({ ...event, attempt: 0 })).toThrow();
  expect(readFileSync(writer.path, "utf8")).toBe(`${JSON.stringify(event)}\n`);
});

const fixtures = new URL("../../../fixtures/events/", import.meta.url);
it.each(readdirSync(fixtures).filter(name => name.endsWith(".jsonl")))("round-trips fixture %s", name => {
  const lines: unknown[] = readFileSync(new URL(name, fixtures), "utf8").trim().split("\n").map(line => JSON.parse(line) as unknown);
  const writer = createEventWriter(dir, name.replace(".jsonl", ""));
  for (const line of lines) writer.emit(eventSchema.parse(line));
  expect(readFileSync(writer.path, "utf8").trim().split("\n").map(line => JSON.parse(line) as unknown)).toEqual(lines);
});

it("scrubs the home directory in nested strings on path boundaries without mutating the input", () => {
  const home = "/hm/ab";
  const writer = createEventWriter(dir, "scrub-1", { homedir: home });
  const input = {
    schemaVersion: 1, seq: 0, ts: "2026-10-31T00:00:00Z", taskId: "scrub-1", type: "verify.finished", attempt: 1,
    passed: false, exitCode: 1, durationMs: 5, outputTail: "in /hm/ab/x and /hm/abc/x and /hm/ab",
  } as unknown as Event;
  const copy = structuredClone(input);
  writer.emit(input);
  expect(input).toEqual(copy);
  const written = JSON.parse(readFileSync(writer.path, "utf8")) as { outputTail: string; exitCode: number; passed: boolean };
  expect(written.outputTail).toBe("in ~/x and /hm/abc/x and ~");
  expect(written.exitCode).toBe(1);
  expect(written.passed).toBe(false);
});

it("scrubs several occurrences with a trailing-slash homedir", () => {
  const writer = createEventWriter(dir, "scrub-2", { homedir: "/hm/ab/" });
  const input = { ...event, taskId: "scrub-2", command: "cd /hm/ab/p && /hm/ab/bin/t" };
  writer.emit(input);
  expect((JSON.parse(readFileSync(writer.path, "utf8")) as { command: string }).command).toBe("cd ~/p && ~/bin/t");
});

it.each(["", "/"])("scrubs nothing for homedir %j", home => {
  const writer = createEventWriter(dir, "scrub-3", { homedir: home });
  writer.emit({ ...event, taskId: "scrub-3", command: "ls /hm/ab/x" });
  expect(readFileSync(writer.path, "utf8")).toContain("ls /hm/ab/x");
});

it("defaults to os.homedir()", () => {
  const writer = createEventWriter(dir, "scrub-4");
  writer.emit({ ...event, taskId: "scrub-4", command: `ls ${homedir()}/x` });
  expect(readFileSync(writer.path, "utf8")).toContain("ls ~/x");
});
