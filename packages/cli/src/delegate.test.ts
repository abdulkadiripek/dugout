import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { vi } from "vitest";
import { join } from "node:path";
import { checkEventLog, structurallyEqual } from "@panosu/core";
import { sample, scripted } from "./providers/test-helper.js";
import type { SpawnFn } from "./providers/index.js";
import { git, invoke, packageFile, readEvents, setup } from "./test-helpers.js";

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { ctx = await setup(); });
afterEach(() => rmSync(ctx.dir, { recursive: true, force: true }));

it.each([
  ["success", "success", "true", 0],
  ["fallback", "fallback", "true", 0],
  ["retry", "success", "test -f ok || { touch ok; exit 1; }", 0],
  ["failed", "success", "false", 2],
  ["all-failed", "all-failed", "true", 2],
  ["review-issues", "review-issues", "true", 1],
] as const)("matches the %s fixture", async (fixture, scenario, verify, code) => {
  const expected = readEvents(new URL(`../../../fixtures/events/${fixture}.jsonl`, import.meta.url).pathname);
  const first = expected[0];
  if (first?.type !== "task.created") throw new Error("Invalid fixture");
  packageFile(ctx.file, { ...first.package, verify });
  const result = await invoke(ctx, ["delegate", ctx.file, "--scenario", scenario, "--events-dir", ctx.events]);
  expect(result.stderr).toBe("");
  expect(result.code).toBe(code);
  const events = readEvents(join(ctx.events, `${first.package.id}-abcd.jsonl`));
  expect(structurallyEqual(events, expected)).toBe(true);
  expect(checkEventLog(events)).toEqual([]);
  expect(result.stdout).not.toContain(ctx.dir);
  expect(result.stdout.split("\n")).toHaveLength(7);
  expect(result.stdout).toContain(`log: ~/events/${first.package.id}-abcd.jsonl\n`);
});

it("commits verify-created files only on the task branch and excludes worktrees once", async () => {
  packageFile(ctx.file, { verify: "echo secret-content > result", review: false });
  const result = await invoke(ctx, ["delegate", ctx.file, "--providers", "fake", "--events-dir", ctx.events]);
  expect(result).toEqual({ code: 0, stderr: "", stdout: "task: task-abcd\nstatus: passed\nattempts: 1\nproviders: fake\nreview: skipped\nlog: ~/events/task-abcd.jsonl\n" });
  const tree = join(ctx.repo, ".worktrees/task-abcd");
  expect(existsSync(tree)).toBe(true);
  expect(await git(tree, "branch", "--show-current")).toBe("panosu/task-abcd");
  expect(await git(ctx.repo, "status", "--porcelain")).toBe("");
  expect(await git(tree, "rev-list", "--count", "main..HEAD")).toBe("1");
  expect(await git(tree, "show", "HEAD:result")).toBe("secret-content");
  expect(existsSync(join(ctx.repo, "result"))).toBe(false);
  expect(await git(tree, "log", "-1", "--format=%s")).toBe("panosu: task-abcd");
  packageFile(ctx.file, { id: "second" });
  expect((await invoke(ctx, ["delegate", ctx.file, "--scenario", "success", "--events-dir", ctx.events])).code).toBe(0);
  expect(readFileSync(join(ctx.repo, ".git/info/exclude"), "utf8").split("\n").filter((line) => line === ".worktrees/")).toHaveLength(1);
});

it.each(["acceptance", "escape", "missing", "parse", "mixed", "positions", "symlink"])("rejects %s before side effects", async (kind) => {
  packageFile(ctx.file);
  const args = ["delegate", ctx.file, "--events-dir", ctx.events];
  if (kind !== "mixed") args.push("--scenario", kind === "positions" ? "fallback" : "success");
  if (kind === "mixed") packageFile(ctx.file, { providers: ["claude", "fake"] });
  if (kind === "acceptance") writeFileSync(ctx.file, readFileSync(ctx.file, "utf8").replace('"acceptance":["Works"],', ""));
  if (kind === "escape") packageFile(ctx.file, { files_to_read: ["../outside"] });
  if (kind === "missing") rmSync(ctx.file);
  if (kind === "parse") writeFileSync(ctx.file, "---\n[bad\n---\n");
  if (kind === "positions") args.push("--providers", "fake");
  if (kind === "symlink") {
    symlinkSync(ctx.dir, join(ctx.repo, "outside"));
    packageFile(ctx.file, { files_to_read: ["outside/missing"] });
  }
  const result = await invoke(ctx, args);
  expect(result.code).toBe(3);
  expect(result.stderr).not.toBe("");
  if (kind === "mixed") expect(result.stderr).toContain("fake cannot be mixed");
  if (kind === "acceptance") expect(result.stderr).toContain("acceptance");
  expect(existsSync(ctx.events)).toBe(false);
  expect(existsSync(join(ctx.repo, ".worktrees"))).toBe(false);
});

it("scrubs the home directory from the event log but not from stdout", async () => {
  packageFile(ctx.file, { verify: "pwd", review: false, files_to_read: [] });
  const result = await invoke(ctx, ["delegate", ctx.file, "--scenario", "success", "--events-dir", ctx.events]);
  expect(result.code).toBe(0);
  const log = readFileSync(join(ctx.events, "task-abcd.jsonl"), "utf8");
  expect(log).not.toContain(ctx.dir);
  const finished = readEvents(join(ctx.events, "task-abcd.jsonl")).find(event => event.type === "verify.finished");
  expect(finished?.type === "verify.finished" ? finished.outputTail : "").toContain("~/");
  expect(result.stdout).toContain("log: ~/events/task-abcd.jsonl\n");
});

it("aborts provider process groups when delegate fails with an error", async () => {
  packageFile(ctx.file, { providers: ["codex"], review: false });
  const lines = await sample("codex/exec-json-tools.sample.jsonl");
  const child = scripted([lines[2]!], 0, true);
  const spawn = vi.fn<SpawnFn>(() => {
    const log = join(ctx.events, "task-abcd.jsonl");
    rmSync(log);
    mkdirSync(log);
    return child;
  });
  const result = await invoke(ctx, ["delegate", ctx.file, "--events-dir", ctx.events, "--providers", "codex"], { spawn });
  expect(result.code).toBe(3);
  expect(spawn).toHaveBeenCalledTimes(1);
  expect(child.kills).toContain("SIGTERM");
});

it("diffs against the commit the run started from even if the base branch advances", async () => {
  const late = join(ctx.repo, "late.txt");
  const verify = `echo mine > mine.txt; echo late > '${late}'; git -C '${ctx.repo}' add late.txt; git -C '${ctx.repo}' -c user.name=t -c user.email=t@localhost commit -qm late`;
  packageFile(ctx.file, { verify, providers: ["codex", "claude"], review: true });
  const prompts: string[] = [];
  const codex = await sample("codex/exec-json-tools.sample.jsonl");
  const approve = { verdict: "approve", summary: "ok", issues: [] };
  const review = JSON.stringify({ ...JSON.parse(readFileSync(new URL("../../../fixtures/providers/claude/print-json-review.sample.json", import.meta.url), "utf8")), result: JSON.stringify(approve), structured_output: approve });
  const spawn = vi.fn<SpawnFn>((command, args) => {
    if (command === "claude") { prompts.push(args.join("\n")); return scripted([review]); }
    return scripted(codex);
  });
  const result = await invoke(ctx, ["delegate", ctx.file, "--events-dir", ctx.events], { spawn });
  expect(result.code).toBe(0);
  expect(await git(ctx.repo, "ls-tree", "--name-only", "main")).toContain("late.txt");
  const finished = readEvents(join(ctx.events, "task-abcd.jsonl")).find(event => event.type === "task.finished");
  expect(finished).toMatchObject({ diffStat: { files: 1 } });
  expect(prompts).toHaveLength(1);
  expect(prompts[0]).toContain("mine.txt");
  expect(prompts[0]).not.toContain("late.txt");
});

it("still reports and exits normally when hooks and signing would break the commit", async () => {
  await git(ctx.repo, "config", "commit.gpgsign", "true");
  await git(ctx.repo, "config", "gpg.program", "/nonexistent/gpg");
  writeFileSync(join(ctx.repo, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  packageFile(ctx.file, { verify: "echo x > result", review: false });
  const result = await invoke(ctx, ["delegate", ctx.file, "--providers", "fake", "--events-dir", ctx.events]);
  expect(result).toMatchObject({ code: 0, stderr: "" });
  expect(result.stdout).toContain("status: passed");
  expect(await git(join(ctx.repo, ".worktrees/task-abcd"), "rev-list", "--count", "main..HEAD")).toBe("1");
});
