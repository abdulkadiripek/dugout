import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTaskPackage } from "@dugout/core";
import { runVerifyCommand } from "./verify-runner.js";

const tasksDir = join(import.meta.dirname, "../../../evals/tasks");
const RUNNABLE = ["01-slugify", "02-fix-off-by-one", "03-extract-function", "05-add-tests", "07-rename-across-files"];

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe.each(RUNNABLE)("eval task %s", (name) => {
  const taskDir = join(tasksDir, name);
  const pkg = parseTaskPackage(readFileSync(join(taskDir, "task.md"), "utf8"));

  it("has a single-command verify and runs with codex and claude", () => {
    expect(pkg.verify).toBe("node --test");
    expect(pkg.providers).toEqual(["codex", "claude"]);
    for (const file of pkg.files_to_read) {
      expect(file).not.toMatch(/hidden|check|solution/);
    }
  });

  it("fails on the seed and passes with the solution", async () => {
    const work = mkdtempSync(join(tmpdir(), "dugout-eval-"));
    made.push(work);
    cpSync(join(taskDir, "seed"), work, { recursive: true });
    cpSync(join(taskDir, "check"), work, { recursive: true });
    const seeded = await runVerifyCommand(work, pkg.verify, { timeoutMs: 25000 });
    expect(seeded.passed, seeded.outputTail).toBe(false);
    expect(seeded.exitCode).not.toBe(0);

    cpSync(join(taskDir, "solution"), work, { recursive: true });
    const solved = await runVerifyCommand(work, pkg.verify, { timeoutMs: 25000 });
    expect(solved.passed, solved.outputTail).toBe(true);
  }, 30000);
});
