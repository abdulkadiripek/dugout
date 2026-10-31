import { expect, it, vi } from "vitest";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { createCodexAdapter } from "./codex.js";
import { reviewJsonSchema, buildReviewPrompt } from "./review-prompt.js";
import { collect, context, input, reviewInput, sample, scripted } from "./test-helper.js";

it("replays implementation tools, messages and usage with the exact invocation", async () => {
  const spawn = vi.fn(() => scripted([]));
  spawn.mockReturnValue(scripted(await sample("codex/exec-json-tools.sample.jsonl")));
  const adapter = createCodexAdapter({ spawn, context });
  const { events, result } = await collect(adapter);
  expect(adapter.name).toBe("codex");
  expect(spawn).toHaveBeenCalledWith("codex", ["exec", "--json", "-m", input.model, "-s", "workspace-write", "-C", input.cwd, input.prompt], { cwd: input.cwd });
  expect(result).toMatchObject({ exitReason: "ok", usage: { inputTokens: 61357, outputTokens: 258 } });
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(events).toContainEqual({ type: "provider.tool", attempt: 1, name: "edit", summary: "packages/core/src/probe.ts" });
  expect(events.filter(e => e.type === "provider.tool" && e.name === "command")).toHaveLength(2);
  expect(events).toContainEqual({ type: "provider.tool", attempt: 1, name: "command", summary: "cat AGENTS.md" });
  expect(events.filter(e => e.type === "provider.message")).toHaveLength(2);
  expect(events.at(-1)).toEqual({ type: "provider.usage", attempt: 1, ...result.usage });
});
it("replays schema failure as crash", async () => {
  const child = scripted(await sample("codex/exec-json-schema-error.sample.jsonl"), 1);
  expect((await collect(createCodexAdapter({ context, spawn: () => child }))).result.exitReason).toBe("crash");
});
it.each([
  [[], 0, null, "invalid_output"],
  [[JSON.stringify({ type: "turn.failed" })], 0, null, "crash"],
  [[JSON.stringify({ type: "error" })], 0, null, "crash"],
  [[JSON.stringify({ type: "turn.completed" })], 1, null, "crash"],
  [[], null, "SIGTERM", "crash"],
  [["broken", JSON.stringify({ type: "turn.completed" })], 0, null, "invalid_output"],
] as const)("classifies output %j / %s / %s", async (lines, code, signal, reason) => {
  expect((await collect(createCodexAdapter({ context, spawn: () => scripted([...lines], code, false, signal) }))).result.exitReason).toBe(reason);
});
it("bounds summaries, removes cwd, and hides outside absolute paths", async () => {
  const lines = [
    { type: "item.completed", item: { type: "command_execution", command: `${input.cwd}/command ${"x".repeat(100)}\nsecret` } },
    { type: "item.completed", item: { type: "file_change", changes: [{ path: `${input.cwd}/a` }, { path: "/elsewhere/b" }, { path: `${input.cwd}/../outside` }] } },
    { type: "item.completed", item: { type: "file_change", changes: [{ path: "x".repeat(300) }] } },
    { type: "item.completed", item: { type: "agent_message", text: "x".repeat(600) } },
    { type: "unknown" }, { type: "turn.completed" },
  ].map(event => JSON.stringify(event));
  const { events } = await collect(createCodexAdapter({ context, spawn: () => scripted(lines) }));
  expect(events[0]).toMatchObject({ summary: `command ${"x".repeat(52)}` });
  expect(events[1]).toMatchObject({ summary: "a, (outside worktree), (outside worktree)" });
  expect(events[2]).toMatchObject({ summary: "x".repeat(200) });
  expect(events[3]).toMatchObject({ text: "x".repeat(500) });
  expect(events).toHaveLength(5);
});
it.each([false, true])("times out or aborts a process that never exits (%s)", async abort => {
  const child = scripted([JSON.stringify({ type: "turn.completed" })], 0, true);
  const controller = new AbortController();
  if (abort) controller.abort();
  const { result } = await collect(createCodexAdapter({ context, spawn: () => child, attemptTimeoutMs: 5 }), { ...input, signal: controller.signal });
  expect(result.exitReason).toBe("timeout");
  expect(child.kills).toEqual(["SIGTERM"]);
});
it("reviews recorded output, passes schema and prompt, and removes the schema", async () => {
  let schemaPath = "";
  const lines = await sample("codex/exec-json-review.sample.jsonl");
  const spawn = vi.fn((_command: string, args: string[]) => {
    schemaPath = args[args.indexOf("--output-schema") + 1] ?? "";
    expect(JSON.parse(readFileSync(schemaPath, "utf8"))).toEqual(reviewJsonSchema);
    return scripted(lines);
  });
  const getDiff = vi.fn(async () => "test diff");
  const result = await createCodexAdapter({ context, spawn, getDiff }).review(reviewInput);
  expect(result.verdict).toBe("approve");
  expect(result.issues).toHaveLength(1);
  expect(result.issues[0]?.severity).toBe("minor");
  expect(getDiff).toHaveBeenCalledWith(input.cwd, "HEAD");
  expect(spawn).toHaveBeenCalledWith("codex", ["exec", "--json", "-m", input.model, "-s", "read-only", "-C", input.cwd, "--skip-git-repo-check", "--ephemeral", "--output-schema", schemaPath, "-o", join(dirname(schemaPath), "output.json"), buildReviewPrompt({ ...context(), diff: "test diff" })], { cwd: input.cwd });
  expect(existsSync(schemaPath)).toBe(false);
});
it.each(["invalid-json", "invalid-review", "crash", "timeout", "null-line"])("handles review %s and cleans up", async scenario => {
  let schemaPath = "";
  const raw = { summary: "review", issues: [{ file: "a", line: null, severity: "minor", message: "fix" }] };
  const text = scenario === "invalid-json" ? "private diff" : JSON.stringify(scenario === "invalid-review" ? {} : raw);
  const lines = [JSON.stringify({ type: "item.completed", item: { type: "agent_message", text } }), JSON.stringify({ type: "turn.completed" })];
  const adapter = createCodexAdapter({ context, getDiff: async () => "private diff", attemptTimeoutMs: 5, spawn: (_command, args) => {
    schemaPath = args[args.indexOf("--output-schema") + 1] ?? "";
    return scripted(lines, scenario === "crash" ? 1 : 0, scenario === "timeout");
  } });
  if (scenario === "null-line") expect((await adapter.review(reviewInput)).issues[0]).not.toHaveProperty("line");
  else await expect(adapter.review(reviewInput)).rejects.toThrow(/^Codex review failed or returned invalid output$/);
  expect(existsSync(schemaPath)).toBe(false);
});

it("maps the recorded usage limit to rate_limit only on a failing exit", async () => {
  const lines = await sample("codex/exec-json-usage-limit.sample.jsonl");
  expect((await collect(createCodexAdapter({ context, spawn: () => scripted(lines, 1) }))).result.exitReason).toBe("rate_limit");
  expect((await collect(createCodexAdapter({ context, spawn: () => scripted(lines, 0) }))).result.exitReason).not.toBe("rate_limit");
});
it("does not treat a usage limit mentioned in a message as rate_limit", async () => {
  const lines = [JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "You hit your usage limit" } })];
  expect((await collect(createCodexAdapter({ context, spawn: () => scripted(lines, 1) }))).result.exitReason).toBe("crash");
});
it("reports a readable usage-limit error from review without a URL", async () => {
  const lines = await sample("codex/exec-json-usage-limit.sample.jsonl");
  const adapter = createCodexAdapter({ context, getDiff: async () => "d", spawn: () => scripted(lines, 1) });
  const error = await adapter.review(reviewInput).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toMatch(/usage limit/i);
  expect((error as Error).message).not.toMatch(/https?:/);
});
