import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import {
  checkEventLog, createFakeScenario, eventSchema, runTask, taskPackageSchema,
  type ReviewResult, type Event, type FakeScenarioSpec, type RunTaskDeps, type TaskPackage,
} from "./index.js";
import { structurallyEqual } from "./structural.js";

const pkg = taskPackageSchema.parse({
  id: "test-task", goal: "Implement the goal", files_to_read: ["src/input.ts"],
  constraints: ["Keep the API"], acceptance: ["Works correctly"], verify: "pnpm test",
});

function setup(spec: FakeScenarioSpec) {
  const scenario = createFakeScenario(spec);
  const events: Event[] = [];
  let tick = 0;
  const deps: RunTaskDeps = {
    ...scenario,
    now: vi.fn(() => new Date(tick++ * 1000)), newId: vi.fn(() => "fixed"),
    diffStat: vi.fn(async () => ({ files: 2, additions: 3, deletions: 1 })),
    models: {
      implement: { codex: "implement-codex", claude: "implement-claude", fake: "implement-fake" },
      review: { codex: "review-codex", claude: "review-claude", fake: "review-fake" },
    },
    emit: (event) => { events.push(event); },
    worktree: { path: ".worktrees/test", branch: "dugout/test", baseRef: "main" },
    signal: new AbortController().signal,
  };
  const run = async (task: TaskPackage = pkg) => {
    const result = await runTask(task, deps);
    expect(checkEventLog(events)).toEqual([]);
    events.forEach((event, seq) => {
      expect(eventSchema.parse(event)).toEqual(event);
      expect(event).toMatchObject({ seq, schemaVersion: 1, taskId: `${task.id}-fixed` });
      expect(event.ts).toBe(new Date((seq + 1 + (event.type === "task.finished" ? 1 : 0)) * 1000).toISOString());
    });
    expect(events[0]).toMatchObject({ type: "task.created", package: task });
    expect(events[1]).toMatchObject({ type: "worktree.created", ...deps.worktree });
    expect(events.at(-1)).toMatchObject({
      type: "task.finished", status: result.status,
      diffStat: { files: 2, additions: 3, deletions: 1 }, durationMs: events.length * 1000,
    });
    expect(deps.diffStat).toHaveBeenCalledOnce();
    expect(result.taskId).toBe(`${task.id}-fixed`);
    return result;
  };
  return { deps, events, run };
}

const fixtures: Record<string, FakeScenarioSpec> = {
  success: { codex: [{ exit: "ok" }], claude: [] },
  retry: { codex: [{ exit: "ok", verify: "fail" }, { exit: "ok" }] },
  fallback: { codex: [{ exit: "rate_limit" }], claude: [{ exit: "ok" }] },
  "review-issues": { codex: [{ exit: "ok" }], claude: [], review: "changes_requested" },
  failed: { codex: [{ exit: "ok", verify: "fail" }, { exit: "ok", verify: "fail" }] },
  "setup-failed": { codex: [], claude: [] },
  "all-failed": { codex: [{ exit: "rate_limit" }], claude: [{ exit: "auth" }] },
};

it.each(Object.entries(fixtures))("matches the %s fixture", async (name, spec) => {
  const fixture = readFileSync(new URL(`../../../fixtures/events/${name}.jsonl`, import.meta.url), "utf8")
    .trim().split("\n").map((line) => eventSchema.parse(JSON.parse(line)));
  const first = fixture[0];
  if (first?.type !== "task.created") throw new Error("Missing task package");
  const test = setup(spec);
  if (name === "setup-failed") {
    test.deps.setup = vi.fn(async () => ({ passed: false, exitCode: 1, durationMs: 10, outputTail: "Setup failed" }));
  }
  const result = await test.run(first.package);
  expect(structurallyEqual(test.events, fixture)).toBe(true);
  const finish = fixture.at(-1);
  expect(result.status).toBe(finish?.type === "task.finished" ? finish.status : undefined);
});

it("gives the fallback provider its own retry budget", async () => {
  const test = setup({
    codex: [{ exit: "rate_limit" }],
    claude: Array.from({ length: 3 }, () => ({ exit: "ok", verify: "fail" })),
  });
  expect((await test.run()).status).toBe("failed");
  expect(test.events.filter((e) => e.type === "attempt.started").map((e) => [e.provider, e.reason]))
    .toEqual([["codex", "initial"], ["claude", "fallback"], ["claude", "retry"], ["claude", "retry"]]);
  expect(test.events.at(-1)).toMatchObject({ attempts: 4, providers: ["codex", "claude"] });
});

it.each(["timeout", "invalid_output"] as const)("exhausts retries on %s without fallback", async (exit) => {
  const test = setup({ codex: [{ exit }, { exit }] });
  const adapter = test.deps.adapters.codex;
  if (!adapter) throw new Error("Missing adapter");
  const run = vi.spyOn(adapter, "run");
  expect((await test.run({ ...pkg, max_retries: 1 })).status).toBe("failed");
  expect(test.events.filter((e) => e.type === "attempt.started").map((e) => e.reason)).toEqual(["initial", "retry"]);
  expect(run.mock.calls[1]?.[0].prompt).toContain(exit);
  expect(test.events.some((e) => e.type === "verify.started" || e.type === "fallback.triggered")).toBe(false);
});

it.each(["rate_limit", "auth", "crash"] as const)("falls back on %s even with no retries", async (exit) => {
  const test = setup({ codex: [{ exit }], claude: [{ exit: "ok" }] });
  expect((await test.run({ ...pkg, max_retries: 0 })).status).toBe("passed");
  expect(test.events.filter((e) => e.type === "fallback.triggered")).toMatchObject([{ from: "codex", to: "claude", reason: exit }]);
  expect(test.events.filter((e) => e.type === "attempt.started").map((e) => e.reason)).toEqual(["initial", "fallback"]);
  expect(test.events.find((e) => e.type === "review.started")).toMatchObject({ provider: "codex" });
});

it("skips review when disabled", async () => {
  const test = setup({ codex: [{ exit: "ok" }] });
  expect((await test.run({ ...pkg, review: false })).status).toBe("passed");
  expect(test.events.some((e) => e.type.startsWith("review."))).toBe(false);
});

it("reviews with the same provider for a single-provider package", async () => {
  const test = setup({ fake: [{ exit: "ok" }] });
  await test.run({ ...pkg, providers: ["fake"] });
  expect(test.events.filter((e) => e.type.startsWith("review."))).toMatchObject([
    { type: "review.started", provider: "fake" }, { type: "review.finished", provider: "fake" },
  ]);
});

it("fails immediately after a failed verify with max_retries zero", async () => {
  const test = setup({ codex: [{ exit: "ok", verify: "fail" }] });
  expect((await test.run({ ...pkg, max_retries: 0 })).status).toBe("failed");
  expect(test.events.at(-1)).toMatchObject({ attempts: 1, providers: ["codex"] });
  expect(test.events.some((e) => e.type === "fallback.triggered")).toBe(false);
});

it("passes dependencies, streams provider events and resets retry feedback on fallback", async () => {
  const test = setup({
    codex: [{ exit: "ok", verify: "fail", durationMs: 42 }, { exit: "crash" }],
    claude: [{ exit: "ok" }],
  });
  const codex = test.deps.adapters.codex;
  const claude = test.deps.adapters.claude;
  if (!codex || !claude) throw new Error("Missing adapters");
  const codexRun = vi.spyOn(codex, "run");
  const claudeRun = vi.spyOn(claude, "run");
  const review = vi.spyOn(codex, "review");
  const tail = Array.from({ length: 35 }, (_, i) => `line ${i}`).join("\n");
  const fakeVerify = test.deps.runVerify;
  const verify = vi.fn(async (cwd: string, command: string) => {
    const outcome = await fakeVerify(cwd, command);
    return outcome.passed ? outcome : {
      passed: false, exitCode: 7, durationMs: 23, outputTail: tail,
    };
  });
  test.deps.runVerify = verify;
  await test.run();
  const original = codexRun.mock.calls[0]?.[0].prompt;
  for (const text of [pkg.goal, ...pkg.constraints, ...pkg.acceptance, ...pkg.files_to_read, pkg.verify]) {
    expect(original).toContain(text);
  }
  expect(codexRun.mock.calls[1]?.[0].prompt).toContain(tail.split("\n").slice(-30).join("\n"));
  expect(claudeRun.mock.calls[0]?.[0].prompt).toBe(original);
  expect(codexRun.mock.calls[0]?.[0]).toMatchObject({
    taskId: "test-task-fixed", attempt: 1, cwd: test.deps.worktree.path,
    model: "implement-codex", signal: test.deps.signal,
  });
  expect(verify).toHaveBeenCalledWith(test.deps.worktree.path, pkg.verify);
  expect(test.events.find((e) => e.type === "attempt.finished")).toMatchObject({ durationMs: 42, status: "completed" });
  expect(test.events.find((e) => e.type === "verify.finished")).toMatchObject({
    outputTail: tail.split("\n").slice(-30).join("\n"), exitCode: 7, durationMs: 23,
  });
  expect(test.events.filter((e) => e.type === "provider.message").map((e) => e.attempt)).toEqual([1, 3]);
  expect(test.events.filter((e) => e.type === "provider.usage").map((e) => e.attempt)).toEqual([1, 3]);
  expect(review).toHaveBeenCalledWith({
    taskId: "test-task-fixed", cwd: test.deps.worktree.path, baseRef: "main",
    model: "review-codex", signal: test.deps.signal,
  });
});

it("reports a missing fallback adapter after emitting the transition", async () => {
  const test = setup({ codex: [{ exit: "rate_limit" }] });
  await expect(runTask(pkg, test.deps)).rejects.toThrow(/claude/);
  expect(test.events.at(-1)).toMatchObject({ type: "fallback.triggered", from: "codex", to: "claude" });
});

it("resets the retry budget after retries on the previous provider", async () => {
  const test = setup({
    codex: [{ exit: "timeout" }, { exit: "rate_limit" }],
    claude: [{ exit: "invalid_output" }, { exit: "ok" }],
  });
  expect((await test.run({ ...pkg, max_retries: 1 })).status).toBe("passed");
  expect(test.events.filter((e) => e.type === "attempt.started").map((e) => [e.provider, e.reason]))
    .toEqual([["codex", "initial"], ["codex", "retry"], ["claude", "fallback"], ["claude", "retry"]]);
});

it("forwards tool events unchanged and selects the first different reviewer", async () => {
  const test = setup({ codex: [{ exit: "ok" }], claude: [], fake: [] });
  const adapter = test.deps.adapters.codex;
  if (!adapter) throw new Error("Missing adapter");
  const originalRun = adapter.run.bind(adapter);
  adapter.run = async function* (input) {
    yield { type: "provider.tool", attempt: 7, name: "edit", summary: "src/input.ts" };
    return yield* originalRun(input);
  };
  await test.run({ ...pkg, providers: ["codex", "fake", "claude"] });
  expect(test.events.find((e) => e.type === "provider.tool")).toMatchObject({
    attempt: 7, name: "edit", summary: "src/input.ts",
  });
  expect(test.events.find((e) => e.type === "review.started")).toMatchObject({
    provider: "fake", model: "review-fake",
  });
  expect(test.events.at(-1)).toMatchObject({ providers: ["codex"] });
});

it("runs setup once after worktree creation and before attempts, trimming its output", async () => {
  const test = setup({ codex: [{ exit: "timeout" }, { exit: "crash" }], claude: [{ exit: "ok" }] });
  const lines = Array.from({ length: 35 }, (_, i) => `line ${i}`);
  test.deps.setup = vi.fn(async () => {
    expect(test.events.map((event) => event.type)).toEqual(["task.created", "worktree.created"]);
    return { passed: true, exitCode: 0, durationMs: 42, outputTail: lines.join("\r\n") };
  });
  expect((await test.run({ ...pkg, setup: "pnpm install --offline --frozen-lockfile" })).status).toBe("passed");
  expect(test.deps.setup).toHaveBeenCalledExactlyOnceWith(test.deps.worktree.path, "pnpm install --offline --frozen-lockfile");
  expect(test.events.slice(0, 4).map((event) => event.type))
    .toEqual(["task.created", "worktree.created", "setup.finished", "attempt.started"]);
  expect(test.events[2]).toMatchObject({ passed: true, exitCode: 0, durationMs: 42, outputTail: lines.slice(-30).join("\n") });
});

it("ends failed setup without attempts, verification or review", async () => {
  const test = setup({ codex: [], claude: [] });
  const runVerify = vi.fn(test.deps.runVerify);
  test.deps.runVerify = runVerify;
  test.deps.setup = vi.fn(async () => ({ passed: false, exitCode: 7, durationMs: 12, outputTail: "Install failed" }));
  expect((await test.run({ ...pkg, setup: "pnpm install --offline --frozen-lockfile" })).status).toBe("failed");
  expect(test.events.map((event) => event.type))
    .toEqual(["task.created", "worktree.created", "setup.finished", "task.finished"]);
  expect(test.events[2]).toMatchObject({ passed: false, exitCode: 7, durationMs: 12, outputTail: "Install failed" });
  expect(test.events.at(-1)).toMatchObject({ attempts: 0, providers: [], diffStat: { files: 2, additions: 3, deletions: 1 } });
  expect(runVerify).not.toHaveBeenCalled();
});

it("rejects missing setup dependency before emitting anything", async () => {
  const test = setup({ codex: [] });
  await expect(runTask({ ...pkg, setup: "pnpm install" }, test.deps)).rejects.toThrow(/Missing deps.setup/);
  expect(test.events).toEqual([]);
  expect(test.deps.diffStat).not.toHaveBeenCalled();
});

it("ignores an available setup dependency when the package has no setup", async () => {
  const baseline = setup({ codex: [{ exit: "ok" }], claude: [] });
  const test = setup({ codex: [{ exit: "ok" }], claude: [] });
  test.deps.setup = vi.fn();
  await baseline.run();
  await test.run();
  expect(test.deps.setup).not.toHaveBeenCalled();
  expect(test.events).toEqual(baseline.events);
});

it.each([new Error("Reviewer failed"), new Error(`First\r\nsecond\rthird\u2028fourth${"x".repeat(250)}`), "Review rejected"])(
  "records reviewer errors and finishes needs_review: %s", async (error) => {
    const test = setup({ codex: [{ exit: "ok" }], claude: [] });
    const adapter = test.deps.adapters.claude;
    if (!adapter) throw new Error("Missing adapter");
    vi.spyOn(adapter, "review").mockRejectedValue(error);
    expect((await test.run()).status).toBe("needs_review");
    const reason = (error instanceof Error ? error.message : error).replace(/[\r\n\u2028\u2029]+/g, " ").slice(0, 200);
    expect(test.events.find((event) => event.type === "review.finished")).toMatchObject({
      provider: "claude", model: "review-claude", result: {
        verdict: "changes_requested", issues: [{ file: ".", severity: "blocker", message: `review unavailable: ${reason}` }],
      },
    });
    expect(test.events.slice(-3).map((event) => event.type)).toEqual(["review.started", "review.finished", "task.finished"]);
  },
);

it.each([{}, { verdict: "approve", summary: "Bad verdict", issues: [{ file: "a.ts", severity: "major", message: "Bug" }] }])(
  "records invalid reviewer output as unavailable: %j", async (invalid) => {
    const test = setup({ codex: [{ exit: "ok" }], claude: [] });
    const adapter = test.deps.adapters.claude;
    if (!adapter) throw new Error("Missing adapter");
    vi.spyOn(adapter, "review").mockResolvedValue(invalid as ReviewResult);
    expect((await test.run()).status).toBe("needs_review");
    const event = test.events.find((event) => event.type === "review.finished");
    if (event?.type !== "review.finished") throw new Error("Missing review.finished");
    expect(event.result.verdict).toBe("changes_requested");
    expect(event.result.issues).toEqual([{ file: ".", severity: "blocker", message: expect.stringMatching(/^review unavailable: /) }]);
    const message = event.result.issues[0]?.message ?? "";
    expect(message).not.toMatch(/[\r\n\u2028\u2029]/);
    expect(message.length).toBeLessThanOrEqual("review unavailable: ".length + 200);
  },
);

it("still throws for a missing reviewer adapter", async () => {
  const test = setup({ codex: [{ exit: "ok" }] });
  await expect(runTask(pkg, test.deps)).rejects.toThrow("Missing adapter for provider claude");
  expect(test.events.at(-1)).toMatchObject({ type: "review.started", provider: "claude" });
});
