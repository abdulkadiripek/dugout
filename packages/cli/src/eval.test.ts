import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cpSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { checkEventLog } from "@dugout/core";
import { git, invoke, readEvents, setup } from "./test-helpers.js";
import { sample, scripted } from "./providers/test-helper.js";
import type { SpawnFn } from "./providers/index.js";

const evalsDir = join(import.meta.dirname, "../../../evals/tasks");
const RUNNABLE = ["01-slugify", "02-fix-off-by-one", "03-extract-function", "05-add-tests", "07-rename-across-files"];

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => { ctx = await setup(); });
afterEach(() => rmSync(ctx.dir, { recursive: true, force: true }));

const evalArgs = (selector: string, ...rest: string[]) => ["eval", selector, "--evals-dir", evalsDir, "--events-dir", ctx.events, ...rest];

async function solver() {
  const lines = await sample("codex/exec-json-tools.sample.jsonl");
  const approve = { verdict: "approve", summary: "Looks good.", issues: [] };
  const review = JSON.stringify({ ...JSON.parse(readFileSync(new URL("../../../fixtures/providers/claude/print-json-review.sample.json", import.meta.url), "utf8")), result: JSON.stringify(approve), structured_output: approve });
  const dirs = new Map(RUNNABLE.map(dir => [dir.replace(/^\d+-/, ""), dir]));
  return vi.fn<SpawnFn>((command, _args, options) => {
    if (command === "claude") return scripted([review]);
    const id = basename(options.cwd).replace(/^eval-/, "").replace(/-[0-9a-f]{4}$/, "");
    const dir = [...dirs].find(([name]) => id === name || id.startsWith(name))?.[1];
    if (!dir) throw new Error(`Unknown task for ${options.cwd}`);
    cpSync(join(evalsDir, dir, "solution"), options.cwd, { recursive: true });
    return scripted(lines);
  });
}

describe("quota guard and selection", () => {
  it("exits 3 without providers or scenario and creates nothing", async () => {
    const result = await invoke(ctx, evalArgs("all"));
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("quota");
    expect(result.stdout).toBe("");
    expect(existsSync(ctx.events)).toBe(false);
  });

  it("exits 3 for an unknown task", async () => {
    const result = await invoke(ctx, evalArgs("nope", "--scenario", "success"));
    expect(result.code).toBe(3);
    expect(result.stderr).toContain("Unknown eval task");
    expect(existsSync(ctx.events)).toBe(false);
  });

  it("exits 3 for a pending task chosen by name", async () => {
    const result = await invoke(ctx, evalArgs("04", "--scenario", "success"));
    expect(result.code).toBe(3);
  });

  it.each(["01", "slugify", "01-slugify"])("selects a single task by %s", async selector => {
    const result = await invoke(ctx, evalArgs(selector, "--scenario", "success"));
    expect(result.code).toBe(0);
    expect(result.stdout.split("\n").filter(Boolean)).toEqual(["01-slugify  failed  2 attempts  codex", "passed 0/1"]);
    expect(readdirSync(ctx.events)).toHaveLength(1);
  }, 30000);
});

describe("eval all", () => {
  it("fake success changes nothing, so every task fails", async () => {
    const result = await invoke(ctx, evalArgs("all", "--scenario", "success"));
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("");
    const lines = result.stdout.split("\n").filter(Boolean);
    expect(lines).toHaveLength(6);
    expect(lines.slice(0, 5).map(line => line.split("  ")[0])).toEqual(RUNNABLE);
    for (const line of lines.slice(0, 5)) expect(line).toMatch(/^\S+  failed  \d+ attempts  codex$/);
    expect(lines[5]).toBe("passed 0/5");
    const logs = readdirSync(ctx.events);
    expect(logs).toHaveLength(5);
    for (const log of logs) expect(checkEventLog(readEvents(join(ctx.events, log)))).toEqual([]);
  }, 120000);

  it("passes all five with a scripted implementer applying the solutions", async () => {
    const spawn = await solver();
    const result = await invoke(ctx, evalArgs("all", "--providers", "codex,claude"), { spawn });
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    const lines = result.stdout.split("\n").filter(Boolean);
    expect(lines.slice(0, 5).map(line => line.split("  ")[0])).toEqual(RUNNABLE);
    for (const line of lines.slice(0, 5)) expect(line).toMatch(/^\S+  passed  1 attempts  codex$/);
    expect(lines[5]).toBe("passed 5/5");
    expect(spawn).toHaveBeenCalledTimes(7);
  }, 120000);

  it("keeps hidden checks out of the task branch and the diff stat", async () => {
    const spawn = await solver();
    const result = await invoke(ctx, evalArgs("slugify", "--providers", "codex,claude", "--keep"), { spawn });
    expect(result.code).toBe(0);
    const kept = /^kept: (.*)$/m.exec(result.stdout)?.[1];
    expect(kept).toBeDefined();
    const worktree = readdirSync(join(kept!, ".worktrees"))[0]!;
    const cwd = join(kept!, ".worktrees", worktree);
    const files = (await git(cwd, "ls-tree", "-r", "--name-only", "HEAD")).split("\n");
    expect(files).toContain("src/slugify.ts");
    expect(files.filter(file => file.includes("hidden"))).toEqual([]);
    expect(existsSync(join(cwd, "slugify.hidden.test.ts"))).toBe(false);
    expect(await git(cwd, "status", "--porcelain")).toBe("");
    const log = readEvents(join(ctx.events, readdirSync(ctx.events)[0]!));
    const finished = log.find(event => event.type === "task.finished");
    expect(finished).toMatchObject({ status: "passed", diffStat: { files: 1 } });
    rmSync(kept!, { recursive: true, force: true });
  }, 60000);
});

describe("overlay collisions", () => {
  it("fails only the colliding task", async () => {
    const copy = join(ctx.dir, "evals");
    for (const dir of ["01-slugify", "02-fix-off-by-one"]) cpSync(join(evalsDir, dir), join(copy, dir), { recursive: true });
    cpSync(join(copy, "01-slugify/check/slugify.hidden.test.ts"), join(copy, "01-slugify/seed/slugify.hidden.test.ts"));
    const spawn = await solver();
    const result = await invoke(ctx, ["eval", "all", "--evals-dir", copy, "--events-dir", ctx.events, "--providers", "codex,claude"], { spawn });
    expect(result.code).toBe(0);
    expect(result.stderr).toContain("slugify.hidden.test.ts");
    for (const log of readdirSync(ctx.events)) {
      const text = readFileSync(join(ctx.events, log), "utf8");
      expect(text).not.toContain("slugify.hidden.test.ts");
    }
    const failed = readEvents(join(ctx.events, readdirSync(ctx.events).find(log => log.includes("slugify"))!)).find(event => event.type === "verify.finished");
    expect(failed?.type === "verify.finished" ? failed.outputTail : "").toContain("reserved path");
    expect(result.stdout.split("\n").filter(Boolean)).toEqual([
      "01-slugify  failed  2 attempts  codex",
      "02-fix-off-by-one  passed  1 attempts  codex",
      "passed 1/2",
    ]);
  }, 60000);
});

describe("--keep", () => {
  it("prints the kept path and leaves it, otherwise removes it", async () => {
    const kept = await invoke(ctx, evalArgs("01", "--scenario", "success", "--keep"));
    const path = /^kept: (.*)$/m.exec(kept.stdout)?.[1];
    expect(path).toBeDefined();
    expect(existsSync(join(path!, "src/slugify.ts"))).toBe(true);
    expect(readFileSync(join(path!, "package.json"), "utf8")).toBeTruthy();
    rmSync(path!, { recursive: true, force: true });
    const plain = await invoke(ctx, evalArgs("01", "--scenario", "success"));
    expect(plain.stdout).not.toContain("kept:");
  }, 60000);
});

