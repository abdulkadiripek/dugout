import { afterEach, beforeEach, expect, it } from "vitest";
import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkEventLog, structurallyEqual } from "@panosu/core";
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

it.each(["acceptance", "escape", "missing", "parse", "real", "positions", "symlink"])("rejects %s before side effects", async (kind) => {
  packageFile(ctx.file);
  const args = ["delegate", ctx.file, "--events-dir", ctx.events];
  if (kind !== "real") args.push("--scenario", kind === "positions" ? "fallback" : "success");
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
  if (kind === "real") expect(result.stderr).toContain("Stage 3");
  if (kind === "acceptance") expect(result.stderr).toContain("acceptance");
  expect(existsSync(ctx.events)).toBe(false);
  expect(existsSync(join(ctx.repo, ".worktrees"))).toBe(false);
});
