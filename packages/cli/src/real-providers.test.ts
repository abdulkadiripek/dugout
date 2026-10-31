import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { checkEventLog } from "@panosu/core";
import { git, invoke, packageFile, readEvents, setup } from "./test-helpers.js";
import { sample, scripted } from "./providers/test-helper.js";
import { reviewJsonSchema } from "./providers/review-prompt.js";
import type { SpawnFn } from "./providers/index.js";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { ctx = await setup(); });
afterEach(() => rmSync(ctx.dir, { recursive: true, force: true }));

async function replay(steps: { fixture?: string; code?: number; implement?: boolean }[]) {
  const outputs = await Promise.all(steps.map(step => step.fixture ? sample(step.fixture) : Promise.resolve(["garbage"])));
  let index = 0;
  return vi.fn<SpawnFn>((command, args, options) => {
    const step = steps[index];
    const lines = outputs[index++];
    if (!step || !lines) throw new Error("Unexpected spawn");
    expect(options.cwd).toBe(join(ctx.repo, ".worktrees/task-abcd"));
    if (step.implement) writeFileSync(join(options.cwd, "model-result"), "model-private-content\n");
    if (command === "codex" && args.includes("--output-schema")) {
      const schema = args[args.indexOf("--output-schema") + 1];
      expect(schema).toBeDefined();
      expect(JSON.parse(readFileSync(schema!, "utf8"))).toEqual(reviewJsonSchema);
    }
    return scripted(lines, step.code ?? 0);
  });
}
function events() {
  const log = readEvents(join(ctx.events, "task-abcd.jsonl"));
  expect(checkEventLog(log)).toEqual([]);
  return log;
}
async function run(spawn: SpawnFn, args: string[] = []) {
  const result = await invoke(ctx, ["delegate", ctx.file, "--events-dir", ctx.events, ...args], { spawn });
  if (result.code !== 3) {
    expect(result.stderr).toBe("");
    expect(result.stdout.split("\n")).toHaveLength(7);
    expect(result.stdout).not.toContain("model-private-content");
    expect(result.stdout).not.toContain("slugify");
    expect(result.stdout).not.toContain("AGENTS.md");
  }
  return result;
}

it.each([false, true])("implements with Codex and cross-reviews with Claude (setup %s)", async withSetup => {
  packageFile(ctx.file, {
    verify: "test -f model-result",
    ...(withSetup ? { setup: "test ! -e setup-count && echo once > setup-count" } : {}),
  });
  const spawn = await replay([
    { fixture: "codex/exec-json-tools.sample.jsonl", implement: true },
    { fixture: "claude/print-json-review.sample.json" },
  ]);
  const result = await run(spawn);
  expect(result).toEqual({ code: 1, stderr: "", stdout: "task: task-abcd\nstatus: needs_review\nattempts: 1\nproviders: codex\nreview: changes_requested (blocker 0, major 2, minor 1, nit 1)\nlog: ~/events/task-abcd.jsonl\n" });
  const log = events();
  expect(log.filter(event => event.type === "setup.finished")).toHaveLength(withSetup ? 1 : 0);
  if (withSetup) {
    expect(log[2]).toMatchObject({ type: "setup.finished", passed: true });
    expect(log[3]).toMatchObject({ type: "attempt.started" });
  }
  expect(log).toContainEqual(expect.objectContaining({ type: "verify.finished", passed: true }));
  expect(log).toContainEqual(expect.objectContaining({ type: "review.finished", provider: "claude" }));
  const cwd = join(ctx.repo, ".worktrees/task-abcd");
  expect(await git(cwd, "show", "HEAD:model-result")).toBe("model-private-content");
  expect(await git(cwd, "branch", "--show-current")).toBe("panosu/task-abcd");
  expect(await git(ctx.repo, "status", "--porcelain")).toBe("");
  expect(existsSync(join(ctx.repo, "model-result"))).toBe(false);
  expect(spawn.mock.calls).toEqual([
    ["codex", ["exec", "--json", "-m", "gpt-6.1-sol", "-s", "workspace-write", "-C", cwd, expect.any(String)], { cwd }],
    ["claude", ["-p", expect.any(String), "--model", "claude-sonnet-5-5", "--output-format", "json", "--json-schema", JSON.stringify(reviewJsonSchema), "--no-session-persistence", "--tools", ""], { cwd }],
  ]);
  const prompt = spawn.mock.calls[1]?.[1][1];
  expect(prompt).toContain("Test");
  expect(prompt).toContain("Works");
  expect(prompt).toContain("model-private-content");
});

it("falls back after Codex crashes and gets an approving Codex review", async () => {
  packageFile(ctx.file, { verify: "test -f model-result" });
  const spawn = await replay([
    { fixture: "codex/exec-json-schema-error.sample.jsonl", code: 1, implement: true },
    { fixture: "claude/stream-json-implement.sample.jsonl", implement: true },
    { fixture: "codex/exec-json-review.sample.jsonl" },
  ]);
  const result = await run(spawn, ["--providers", "codex,claude"]);
  expect(result.code).toBe(0);
  expect(result.stdout).toContain("providers: codex,claude\nreview: approve");
  const log = events();
  expect(log).toContainEqual(expect.objectContaining({ type: "attempt.finished", attempt: 1, exitReason: "crash" }));
  expect(log).toContainEqual(expect.objectContaining({ type: "fallback.triggered", from: "codex", to: "claude", reason: "crash" }));
  expect(log).toContainEqual(expect.objectContaining({ type: "attempt.finished", attempt: 2, exitReason: "ok" }));
  expect(log).toContainEqual(expect.objectContaining({ type: "review.finished", provider: "codex", result: expect.objectContaining({ verdict: "approve" }) }));
  const cwd = join(ctx.repo, ".worktrees/task-abcd");
  const schema = spawn.mock.calls[2]?.[1][11];
  expect(typeof schema).toBe("string");
  expect(spawn.mock.calls).toEqual([
    ["codex", ["exec", "--json", "-m", "gpt-6.1-sol", "-s", "workspace-write", "-C", cwd, expect.any(String)], { cwd }],
    ["claude", ["-p", expect.any(String), "--model", "claude-sonnet-5-5", "--output-format", "stream-json", "--verbose", "--no-session-persistence", "--permission-mode", "acceptEdits", "--allowedTools", "Write", "Edit", "Read"], { cwd }],
    ["codex", ["exec", "--json", "-m", "gpt-6.1-sol", "-s", "read-only", "-C", cwd, "--skip-git-repo-check", "--ephemeral", "--output-schema", schema, "-o", join(dirname(schema!), "output.json"), expect.any(String)], { cwd }],
  ]);
});

it("fails without review when both implementers crash", async () => {
  packageFile(ctx.file);
  const spawn = await replay([
    { fixture: "codex/exec-json-schema-error.sample.jsonl", code: 1 },
    { fixture: "claude/stream-json-implement.sample.jsonl", code: 1 },
  ]);
  expect((await run(spawn)).code).toBe(2);
  const log = events();
  expect(log.filter(event => event.type === "attempt.finished").map(event => event.exitReason)).toEqual(["crash", "crash"]);
  expect(log.some(event => event.type === "review.started")).toBe(false);
  expect(log.at(-1)).toMatchObject({ status: "failed", attempts: 2 });
  expect(spawn).toHaveBeenCalledTimes(2);
});

it("records a review unavailable blocker for garbage output", async () => {
  packageFile(ctx.file, { verify: "test -f model-result" });
  const spawn = await replay([{ fixture: "codex/exec-json-tools.sample.jsonl", implement: true }, {}]);
  expect((await run(spawn)).code).toBe(1);
  expect(events()).toContainEqual(expect.objectContaining({ type: "review.finished", result: expect.objectContaining({
    verdict: "changes_requested", issues: [{ file: ".", severity: "blocker", message: expect.stringContaining("review unavailable:") }],
  }) }));
});

it("stops before spawning or staging when setup fails", async () => {
  packageFile(ctx.file, { setup: "echo setup-private-content > setup-result; exit 3" });
  const spawn = await replay([]);
  expect((await run(spawn)).code).toBe(2);
  expect(spawn).not.toHaveBeenCalled();
  const log = events();
  expect(log.map(event => event.type)).toEqual(["task.created", "worktree.created", "setup.finished", "task.finished"]);
  expect(log[2]).toMatchObject({ passed: false, exitCode: 3 });
  expect(log[3]).toMatchObject({ attempts: 0, status: "failed", providers: [] });
  const cwd = join(ctx.repo, ".worktrees/task-abcd");
  expect(await git(cwd, "diff", "--cached", "--name-only")).toBe("");
  expect(await git(cwd, "rev-list", "--count", "main..HEAD")).toBe("0");
});

it.each(["claude,fake", "nonsense"])("rejects --providers %s before side effects", async providers => {
  packageFile(ctx.file);
  const spawn = await replay([]);
  const result = await run(spawn, ["--providers", providers]);
  expect(result.code).toBe(3);
  expect(result.stderr).toMatch(/fake cannot be mixed|Unknown provider: nonsense/);
  expect(spawn).not.toHaveBeenCalled();
  expect(existsSync(ctx.events)).toBe(false);
  expect(existsSync(join(ctx.repo, ".worktrees"))).toBe(false);
});

it.each([["--scenario", "success"], ["--providers", "fake"]])("keeps fake mode independent of spawn (%s %s)", async (flag, value) => {
  packageFile(ctx.file);
  const spawn = await replay([]);
  expect((await run(spawn, [flag, value])).code).toBe(0);
  expect(spawn).not.toHaveBeenCalled();
  events();
});

it("passes claude.allowedTools from config to the spawned Claude argv", async () => {
  mkdirSync(join(ctx.dir, ".ajan-panosu"), { recursive: true });
  writeFileSync(join(ctx.dir, ".ajan-panosu", "config.json"), JSON.stringify({ claude: { allowedTools: ["Write", "Bash(pnpm *)"] } }));
  packageFile(ctx.file, { verify: "test -f model-result" });
  const spawn = await replay([
    { fixture: "claude/stream-json-implement.sample.jsonl", implement: true },
    { fixture: "codex/exec-json-review.sample.jsonl" },
  ]);
  await run(spawn, ["--providers", "claude,codex"]);
  expect(spawn.mock.calls[0]?.[1].slice(-3)).toEqual(["--allowedTools", "Write", "Bash(pnpm *)"]);
});
