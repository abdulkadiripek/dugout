import { expect, it, vi } from "vitest";
import { createClaudeAdapter } from "./claude.js";
import { buildReviewPrompt, reviewJsonSchema } from "./review-prompt.js";
import { collect, context, input, reviewInput, sample, scripted } from "./test-helper.js";

it("replays implementation output and invokes the exact command", async () => {
  const child = scripted(await sample("claude/stream-json-implement.sample.jsonl"));
  const spawn = vi.fn(() => child);
  const adapter = createClaudeAdapter({ context, spawn });
  const { events, result } = await collect(adapter);
  expect(adapter.name).toBe("claude");
  expect(spawn).toHaveBeenCalledWith("claude", ["-p", input.prompt, "--model", input.model, "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--permission-mode", "acceptEdits", "--allowedTools", "Write", "Edit", "Read"], { cwd: input.cwd });
  expect(result).toMatchObject({ exitReason: "ok", usage: { inputTokens: 37309, outputTokens: 374 } });
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(events).toHaveLength(3);
  expect(events[0]).toEqual({ type: "provider.tool", attempt: 1, name: "write", summary: "hello.txt" });
  expect(events[1]?.type).toBe("provider.message");
  expect(events[2]).toEqual({ type: "provider.usage", attempt: 1, ...result.usage });
});
it("passes a custom allowedTools list as separate argv items", async () => {
  const spawn = vi.fn(() => scripted(["x"]));
  await collect(createClaudeAdapter({ context, spawn, allowedTools: ["Read", "Bash(pnpm *)", "Write"] }));
  expect(spawn).toHaveBeenCalledWith("claude", ["-p", input.prompt, "--model", input.model, "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--permission-mode", "acceptEdits", "--allowedTools", "Read", "Bash(pnpm *)", "Write"], { cwd: input.cwd });
});
it.each([
  [[], 0, null, "invalid_output"],
  [[{ type: "result", subtype: "success", is_error: true }], 0, null, "crash"],
  [[{ type: "result", subtype: "error", is_error: false }], 0, null, "crash"],
  [[{ type: "result", subtype: "success", is_error: false }], 1, null, "crash"],
  [[], null, "SIGTERM", "crash"],
  [[{ type: "system" }, { type: "rate_limit_event" }], 0, null, "invalid_output"],
] as const)("classifies result %j / %s / %s", async (events, code, signal, reason) => {
  const { result } = await collect(createClaudeAdapter({ context, spawn: () => scripted(events.map(e => JSON.stringify(e)), code, false, signal) }));
  expect(result.exitReason).toBe(reason);
});
it("truncates text, permits absent tool paths and rejects malformed JSON", async () => {
  const lines = ["bad json", JSON.stringify({ type: "assistant", message: { content: [
    { type: "text", text: "a".repeat(600) }, { type: "tool_use", name: "Read", input: {} },
  ] } })];
  const { events, result } = await collect(createClaudeAdapter({ context, spawn: () => scripted(lines) }));
  expect(events).toEqual([{ type: "provider.message", attempt: 1, text: "a".repeat(500) }, { type: "provider.tool", attempt: 1, name: "read", summary: "" }]);
  expect(result.exitReason).toBe("invalid_output");
});
it("summarizes Bash tool_use without leaking secret values", async () => {
  const lines = [JSON.stringify({ type: "assistant", message: { content: [
    { type: "tool_use", name: "Bash", input: { command: "API_KEY=sk-test pnpm test --watch\nrm -rf /" } },
    { type: "tool_use", name: "Bash", input: {} },
  ] } })];
  const { events } = await collect(createClaudeAdapter({ context, spawn: () => scripted(lines) }));
  expect(events).toEqual([
    { type: "provider.tool", attempt: 1, name: "bash", summary: "API_KEY=… pnpm test" },
    { type: "provider.tool", attempt: 1, name: "bash", summary: "" },
  ]);
  expect(JSON.stringify(events)).not.toContain("sk-test");
});
it.each([false, true])("times out or aborts without waiting for exit (%s)", async abort => {
  const child = scripted([], 0, true);
  const controller = new AbortController();
  const timer = abort ? setTimeout(() => controller.abort(), 2) : undefined;
  const { result } = await collect(createClaudeAdapter({ context, spawn: () => child, attemptTimeoutMs: 5 }), { ...input, signal: controller.signal });
  clearTimeout(timer);
  expect(result.exitReason).toBe("timeout");
  expect(child.kills).toEqual(["SIGTERM"]);
});
it("reviews the recorded JSON document with the exact command", async () => {
  const child = scripted(await sample("claude/print-json-review.sample.json"));
  const spawn = vi.fn(() => child);
  const getDiff = vi.fn(async () => "test diff");
  const result = await createClaudeAdapter({ context, spawn, getDiff }).review(reviewInput);
  expect(result.verdict).toBe("changes_requested");
  expect(result.issues.filter(i => i.severity === "major")).toHaveLength(2);
  expect(getDiff).toHaveBeenCalledWith(input.cwd, "HEAD");
  expect(spawn).toHaveBeenCalledWith("claude", ["-p", buildReviewPrompt({ ...context(), diff: "test diff" }), "--model", input.model, "--output-format", "json", "--json-schema", JSON.stringify(reviewJsonSchema), "--no-session-persistence", "--tools", ""], { cwd: input.cwd });
});
it("falls back to result JSON and normalizes null lines", async () => {
  const result = { subtype: "success", is_error: false, result: JSON.stringify({ summary: "ok", issues: [{ file: "a", line: null, severity: "nit", message: "fix" }] }) };
  const review = await createClaudeAdapter({ context, getDiff: async () => "", spawn: () => scripted([JSON.stringify(result)]) }).review(reviewInput);
  expect(review.verdict).toBe("approve");
  expect(review.issues[0]).not.toHaveProperty("line");
});
it.each(["bad json", "{}", '{"is_error":true}', '{"is_error":false,"subtype":"success","result":"bad"}'])("sanitizes review errors for %s", async line => {
  await expect(createClaudeAdapter({ context, getDiff: async () => "private diff", spawn: () => scripted([line]) }).review(reviewInput)).rejects.toThrow(/^Claude review failed or returned invalid output$/);
});
it.each(["crash", "timeout", "spawn", "diff"])("handles review %s", async mode => {
  await expect(createClaudeAdapter({ context, attemptTimeoutMs: 5, getDiff: async () => { if (mode === "diff") throw new Error("private diff"); return ""; }, spawn: () => {
    if (mode === "spawn") throw new Error("private diff");
    return scripted([], mode === "crash" ? 1 : 0, mode === "timeout");
  } }).review(reviewInput)).rejects.toThrow(/^Claude review failed or returned invalid output$/);
});
